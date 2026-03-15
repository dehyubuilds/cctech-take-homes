import { NextRequest, NextResponse } from "next/server";
import { getAuthService, getTwilioAdapter } from "@/lib/services";
import { getUserRepository } from "@/lib/repositories";
import { config } from "@/lib/config";
import { getPendingCode, clearPendingCode } from "@/lib/phone-verify-store";
import {
  isDynamoVerifyConfigured,
  getPendingCodeAsync,
  clearPendingCodeAsync,
} from "@/lib/phone-verify-dynamo";

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && !phone.trim().startsWith("+")) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.trim().startsWith("+") ? phone.trim() : `+${digits}`;
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Verification code required" }, { status: 400 });
  }

  if (config.twilio.verifyServiceId) {
    const userRepo = getUserRepository();
    const user = await userRepo.getById(session.userId);
    if (!user?.phoneNumber?.trim()) {
      return NextResponse.json({ error: "No phone number on profile" }, { status: 400 });
    }
    const twilio = getTwilioAdapter();
    const check = await twilio.checkVerification(toE164(user.phoneNumber), code);
    if (!check.success) {
      return NextResponse.json(
        { error: check.error || "Invalid or expired code" },
        { status: 400 }
      );
    }
    const updates: { phoneVerified: true; smsStatus?: "active" } = { phoneVerified: true };
    if (user.smsStatus === "pending") updates.smsStatus = "active";
    await userRepo.update(session.userId, updates);
    return NextResponse.json({ ok: true, message: "Phone verified." });
  }

  let pending = isDynamoVerifyConfigured()
    ? await getPendingCodeAsync(session.userId)
    : getPendingCode(session.userId);
  if (!pending && config.dynamo.useReal) {
    const userRepo = getUserRepository();
    const userWithCode = await userRepo.getById(session.userId);
    if (
      userWithCode?.verifyCode &&
      typeof userWithCode.verifyCodeExpiresAt === "number" &&
      Date.now() <= userWithCode.verifyCodeExpiresAt
    ) {
      pending = { code: userWithCode.verifyCode, expiresAt: userWithCode.verifyCodeExpiresAt };
    }
  }
  if (!pending) {
    return NextResponse.json(
      { error: "No verification in progress or code expired. Request a new code." },
      { status: 400 }
    );
  }
  if (pending.code !== code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }
  if (isDynamoVerifyConfigured()) {
    await clearPendingCodeAsync(session.userId);
  } else {
    clearPendingCode(session.userId);
  }
  const userRepo = getUserRepository();
  const user = await userRepo.getById(session.userId);
  const updates: Partial<import("@/lib/domain").User> = {
    phoneVerified: true,
    verifyCode: undefined,
    verifyCodeExpiresAt: undefined,
  };
  if (user?.smsStatus === "pending") {
    updates.smsStatus = "active";
  }
  await userRepo.update(session.userId, updates);
  return NextResponse.json({ ok: true, message: "Phone verified." });
}
