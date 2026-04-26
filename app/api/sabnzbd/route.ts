import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const sabnzbdUrl = request.headers.get("x-sabnzbd-url") || "http://localhost:8080";
  const sabnzbdApiKey = request.headers.get("x-sabnzbd-apikey") || "";

  const { searchParams } = new URL(request.url);

  // Build SABnzbd API URL — single endpoint with query params
  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    params.set(key, value);
  });
  if (!params.has("output")) {
    params.set("output", "json");
  }
  if (sabnzbdApiKey) {
    params.set("apikey", sabnzbdApiKey);
  }

  const base = sabnzbdUrl.replace(/\/$/, "");
  const targetUrl = `${base}/api?${params.toString()}`;

  try {
    const response = await fetch(targetUrl, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `SABnzbd responded with ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "SABnzbd unreachable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const sabnzbdUrl = request.headers.get("x-sabnzbd-url") || "http://localhost:8080";
  const sabnzbdApiKey = request.headers.get("x-sabnzbd-apikey") || "";

  const { searchParams } = new URL(request.url);

  const params = new URLSearchParams();
  searchParams.forEach((value, key) => {
    params.set(key, value);
  });
  if (!params.has("output")) {
    params.set("output", "json");
  }
  if (sabnzbdApiKey) {
    params.set("apikey", sabnzbdApiKey);
  }

  // Also merge POST body params
  try {
    const body = await request.formData();
    body.forEach((value, key) => {
      params.set(key, value.toString());
    });
  } catch {
    // ignore – might not have a body
  }

  const base = sabnzbdUrl.replace(/\/$/, "");
  const targetUrl = `${base}/api`;

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `SABnzbd responded with ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "SABnzbd unreachable";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
