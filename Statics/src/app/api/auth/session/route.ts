import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session) {
    return NextResponse.json({}, { status: 401 });
  }
  return NextResponse.json(session);
}
