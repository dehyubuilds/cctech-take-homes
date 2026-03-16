import { NextResponse } from "next/server";

/** So we can confirm which build is live. Auth uses inlined constants when this is "auth-inline". */
const BUILD_MARKER = "auth-inline-v2";

export async function GET() {
  return NextResponse.json({ build: BUILD_MARKER });
}
