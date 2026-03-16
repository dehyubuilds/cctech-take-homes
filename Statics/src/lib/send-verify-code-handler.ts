import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { getUserRepository } from "@/lib/repositories";
import { getTwilioAdapter } from "@/lib/services";
import { config } from "@/lib/config";
import { setPendingCode, clearPendingCode } from "@/lib/phone-verify-store";
import {
  isDynamoVerifyConfigured,
  setPendingCodeAsync,
  clearPendingCodeAsync,
} from "@/lib/phone-verify-dynamo";

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && !phone.trim().startsWith("+")) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.trim().startsWith("+") ? phone.trim() : `+${digits}`;
}

export async function handleSendVerifyCode(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = request.headers.get("Authorization");
    const token = auth?.replace("Bearer ", "") ?? null;
    const authService = getAuthService();
    const session = await authService.getSessionUser(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userRepo = getUserRepository();
    const user = await userRepo.getById(session.userId);
    if (!user?.phoneNumber?.trim()) {
      return NextResponse.json(
        { error: "Add a phone number in Profile first, then request a code." },
        { status: 400 }
      );
    }
    if (!config.twilio.useReal) {
      return NextResponse.json(
        { error: "SMS is not configured. Phone verification is unavailable." },
        { status: 503 }
      );
    }

    const to = toE164(user.phoneNumber);
    const twilio = getTwilioAdapter();

    if (config.twilio.verifyServiceId) {
      const sent = await twilio.sendVerification(to);
      if (!sent.success) {
        return NextResponse.json(
          { error: sent.error || "Failed to send verification code" },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, message: "Verification code sent." });
    }

    const code = randomCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min
    if (isDynamoVerifyConfigured()) {
      await setPendingCodeAsync(session.userId, code, expiresAt);
    } else {
      setPendingCode(session.userId, code, expiresAt);
    }
    if (config.dynamo.useReal) {
      await userRepo.update(session.userId, { verifyCode: code, verifyCodeExpiresAt: expiresAt });
    }
    const sent = await twilio.sendSms(
      to,
      `Your Statics verification code is: ${code}. It expires in 10 minutes.`
    );
    if (!sent.success) {
      if (isDynamoVerifyConfigured()) {
        await clearPendingCodeAsync(session.userId);
      } else {
        clearPendingCode(session.userId);
      }
      return NextResponse.json(
        { error: sent.error || "Failed to send SMS" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, message: "Verification code sent." });
  } catch (err: unknown) {
    const message = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Failed to send code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
