import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "statics",
    timestamp: new Date().toISOString(),
    persistence: "dynamodb",
    authConfigured: true,
    avatarConfigured: true,
  });
}
