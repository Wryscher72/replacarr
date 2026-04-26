import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SETTINGS_FILE = process.env.SETTINGS_FILE ?? "/data/settings.json";

function ensureDir() {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export async function GET() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      return new NextResponse(null, { status: 404 });
    }
    const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return new NextResponse(data, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[settings] GET error:", err);
    return new NextResponse(null, { status: 500 });
  }
}

const MAX_BODY_BYTES = 64 * 1024; // 64 KB — settings are small

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return new NextResponse("Payload too large", { status: 413 });
    }

    ensureDir();
    const body = await req.text();

    if (body.length > MAX_BODY_BYTES) {
      return new NextResponse("Payload too large", { status: 413 });
    }

    // Validate that the body is valid JSON and a plain object before writing
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return new NextResponse("Invalid JSON", { status: 400 });
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return new NextResponse("Settings must be a JSON object", { status: 400 });
    }

    fs.writeFileSync(SETTINGS_FILE, body, "utf-8");
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[settings] POST error:", err);
    return new NextResponse(null, { status: 500 });
  }
}

export async function DELETE() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      fs.unlinkSync(SETTINGS_FILE);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[settings] DELETE error:", err);
    return new NextResponse(null, { status: 500 });
  }
}
