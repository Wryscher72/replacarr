import { type NextRequest, NextResponse } from "next/server";

// Sonarr API proxy — forwards all /api/sonarr/... requests to the running Sonarr instance.
// API credentials are read from env vars (set in .env.local) so they are never exposed
// to the browser bundle.

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const sonarrUrl =
    req.headers.get("x-sonarr-url") ||
    process.env.SONARR_URL ||
    "http://localhost:8989";
  const sonarrApiKey =
    req.headers.get("x-sonarr-apikey") ||
    process.env.SONARR_API_KEY ||
    "";

  const targetPath = path.join("/");
  const searchParams = req.nextUrl.searchParams.toString();
  const targetUrl = `${sonarrUrl}/api/v3/${targetPath}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "X-Api-Key": sonarrApiKey,
        "Content-Type": "application/json",
      },
      body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.text(),
      // 90 s — release searches poll every indexer and can be slow
      signal: AbortSignal.timeout(90000),
    });

    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await upstream.json();
      return NextResponse.json(json, { status: upstream.status });
    }

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": contentType },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to reach Sonarr", detail: message },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
