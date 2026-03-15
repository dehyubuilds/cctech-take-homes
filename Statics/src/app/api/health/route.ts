import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "statics",
    timestamp: new Date().toISOString(),
    /** "mock" = in-memory, lost on restart; "dynamodb" = persistent */
    persistence: config.dynamo.useReal ? "dynamodb" : "mock",
  });
}
