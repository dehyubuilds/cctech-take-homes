import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { getUserRepository } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session || !authService.isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userRepo = getUserRepository();
  const users = await userRepo.list();
  return NextResponse.json({ users });
}
