import { type NextRequest, NextResponse } from "next/server";

const TMDB_BASE = "https://api.themoviedb.org/3";

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiKey =
    req.headers.get("x-tmdb-apikey") || process.env.TMDB_API_KEY || "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB API key not configured." },
      { status: 401 }
    );
  }

  const targetPath = path.join("/");
  const searchParams = req.nextUrl.searchParams;
  searchParams.set("api_key", apiKey);
  const targetUrl = `${TMDB_BASE}/${targetPath}?${searchParams.toString()}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to reach TMDB", detail: message },
      { status: 502 }
    );
  }
}

export const GET = handler;
