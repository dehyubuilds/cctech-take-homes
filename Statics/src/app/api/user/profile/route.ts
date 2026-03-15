import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { getUserRepository } from "@/lib/repositories";
import type { User, SmsStatus } from "@/lib/domain";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user;
  const { verifyCode: _vc, verifyCodeExpiresAt: _vce, ...safe } = user as typeof user & { verifyCode?: string; verifyCodeExpiresAt?: number };
  return NextResponse.json(safe);
}

export async function PATCH(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { phoneNumber, smsStatus, avatarUrl } = body;
  const userRepo = getUserRepository();
  const updates: Partial<User> = {};
  if (smsStatus !== undefined && ["active", "opted_out", "pending"].includes(smsStatus)) {
    updates.smsStatus = smsStatus as SmsStatus;
  }
  if (avatarUrl !== undefined) {
    updates.avatarUrl = avatarUrl === "" ? undefined : avatarUrl;
  }
  if (phoneNumber !== undefined) {
    updates.phoneNumber = phoneNumber.trim() || undefined;
    updates.phoneVerified = false; // require re-verification when number changes
  }
  const updated = await userRepo.update(session.userId, updates);
  if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });
  const { verifyCode: _v2, verifyCodeExpiresAt: _vce2, ...safe } = updated as typeof updated & { verifyCode?: string; verifyCodeExpiresAt?: number };
  return NextResponse.json(safe);
}
