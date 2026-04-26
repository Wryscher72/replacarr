import { type NextRequest, NextResponse } from "next/server";

// Radarr API proxy — forwards all /api/radarr/... requests to the running Radarr instance.

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const radarrUrl =
    req.headers.get("x-radarr-url") ||
    process.env.RADARR_URL ||
    "http://localhost:7878";
  const radarrApiKey =
    req.headers.get("x-radarr-apikey") ||
    process.env.RADARR_API_KEY ||
    "";

  const targetPath = path.join("/");
  const searchParams = req.nextUrl.searchParams.toString();
  const targetUrl = `${radarrUrl}/api/v3/${targetPath}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "X-Api-Key": radarrApiKey,
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
      { error: "Failed to reach Radarr", detail: message },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
