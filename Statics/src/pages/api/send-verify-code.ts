/**
 * Pages Router API route — same pattern as Twilly: Twilio Verify API, hardcoded creds.
 * Netlify serves this reliably; client calls POST /api/send-verify-code.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import twilio from "twilio";
import { getAuthService } from "@/lib/services";
import { getUserRepository } from "@/lib/repositories";
import { config } from "@/lib/config";

const accountSid = config.twilio.accountSid;
const authToken = config.twilio.authToken;
const verifyServiceId = config.twilio.verifyServiceId;

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && !phone.trim().startsWith("+")) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.trim().startsWith("+") ? phone.trim() : `+${digits}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = req.headers.authorization;
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userRepo = getUserRepository();
  const user = await userRepo.getById(session.userId);
  if (!user?.phoneNumber?.trim()) {
    return res.status(400).json({
      error: "Add a phone number in Profile first, then request a code.",
    });
  }

  if (!config.twilio.useReal || !verifyServiceId) {
    return res.status(503).json({
      error: "SMS is not configured. Phone verification is unavailable.",
    });
  }

  const to = toE164(user.phoneNumber);
  const client = twilio(accountSid, authToken);

  const STATICS_FRIENDLY_NAME = "Statics";

  try {
    // Ensure Verify service friendly name is "Statics" so SMS says "Your Statics verification code is: {code}"
    const service = await client.verify.v2.services(verifyServiceId).fetch();
    if (service.friendlyName !== STATICS_FRIENDLY_NAME) {
      await client.verify.v2.services(verifyServiceId).update({ friendlyName: STATICS_FRIENDLY_NAME });
    }

    const verification = await client.verify.v2
      .services(verifyServiceId)
      .verifications.create({ to, channel: "sms" });

    if (verification.status === "pending") {
      return res.status(200).json({ ok: true, message: "Verification code sent." });
    }
    return res.status(500).json({
      error: "Failed to send verification code",
    });
  } catch (err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Failed to send code";
    return res.status(500).json({ error: message });
  }
}
