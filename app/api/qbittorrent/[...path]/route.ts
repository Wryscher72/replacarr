import { type NextRequest, NextResponse } from "next/server";

// qBittorrent Web API proxy
// qBittorrent uses cookie-based session auth (SID cookie from POST /api/v2/auth/login)
// We cache the SID per {url+username} to avoid logging in on every request.

interface SessionEntry {
  sid: string;
  expiry: number; // ms timestamp
}

const sessionCache = new Map<string, SessionEntry>();
const SESSION_TTL_MS = 55 * 60 * 1000; // 55 minutes (qBt default session is 1 hour)

async function getSession(qbtUrl: string, username: string, password: string): Promise<string | null> {
  const cacheKey = `${qbtUrl}::${username}`;
  const existing = sessionCache.get(cacheKey);
  if (existing && Date.now() < existing.expiry) {
    return existing.sid;
  }

  // Login to get new SID
  try {
    const loginUrl = `${qbtUrl}/api/v2/auth/login`;
    const body = new URLSearchParams({ username, password });
    const res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    // qBittorrent returns "Ok." on success
    const text = await res.text();
    if (text.trim() !== "Ok.") {
      return null;
    }

    // Parse SID from Set-Cookie header
    const setCookie = res.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/SID=([^;]+)/);
    if (!match) return null;

    const sid = match[1];
    sessionCache.set(cacheKey, { sid, expiry: Date.now() + SESSION_TTL_MS });
    return sid;
  } catch {
    return null;
  }
}

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  const qbtUrl =
    req.headers.get("x-qbt-url") ||
    process.env.QBITTORRENT_URL ||
    "http://localhost:8080";
  const username =
    req.headers.get("x-qbt-username") ||
    process.env.QBITTORRENT_USERNAME ||
    "admin";
  const password =
    req.headers.get("x-qbt-password") ||
    process.env.QBITTORRENT_PASSWORD ||
    "";

  // The /login endpoint is handled specially — the client can call it directly
  // but we also handle it transparently via session caching.
  const pathStr = path.join("/");
  const searchParams = req.nextUrl.searchParams.toString();
  const targetUrl = `${qbtUrl}/api/v2/${pathStr}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const sid = await getSession(qbtUrl, username, password);
    if (!sid) {
      return NextResponse.json(
        { error: "qBittorrent authentication failed. Check URL, username, and password." },
        { status: 401 }
      );
    }

    const bodyText = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        Cookie: `SID=${sid}`,
        ...(bodyText ? { "Content-Type": req.headers.get("content-type") ?? "application/x-www-form-urlencoded" } : {}),
      },
      body: bodyText,
    });

    // If 403, session expired — clear cache and retry once
    if (upstream.status === 403) {
      const cacheKey = `${qbtUrl}::${username}`;
      sessionCache.delete(cacheKey);

      const freshSid = await getSession(qbtUrl, username, password);
      if (!freshSid) {
        return NextResponse.json({ error: "qBittorrent re-authentication failed." }, { status: 401 });
      }

      const retry = await fetch(targetUrl, {
        method: req.method,
        headers: {
          Cookie: `SID=${freshSid}`,
          ...(bodyText ? { "Content-Type": req.headers.get("content-type") ?? "application/x-www-form-urlencoded" } : {}),
        },
        body: bodyText,
      });

      return buildResponse(retry);
    }

    return buildResponse(upstream);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to reach qBittorrent", detail: message },
      { status: 502 }
    );
  }
}

async function buildResponse(res: Response): Promise<NextResponse> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  }
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": contentType || "text/plain" },
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
