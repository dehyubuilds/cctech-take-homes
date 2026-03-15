import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  authService.signOut(token);
  return NextResponse.json({ ok: true });
}
