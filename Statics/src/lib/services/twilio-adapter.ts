import twilio from "twilio";
import { config } from "@/lib/config";
import type { SmsStatus } from "@/lib/domain";

/**
 * Twilio adapter: send SMS, Verify API (2FA), and webhook actions.
 * Uses real Twilio when credentials are set; otherwise no-op (returns error).
 */
export interface TwilioSendResult {
  success: boolean;
  sid?: string;
  error?: string;
}

export function getTwilioAdapter() {
  const client =
    config.twilio.useReal &&
    twilio(config.twilio.accountSid, config.twilio.authToken);
  const verifyServiceId = config.twilio.verifyServiceId;

  return {
    async sendSms(to: string, body: string): Promise<TwilioSendResult> {
      if (!config.twilio.useReal || !client) {
        return { success: false, error: "Twilio not configured" };
      }
      try {
        const msg = await client.messages.create({
          to,
          from: config.twilio.phoneNumber,
          body,
        });
        return { success: true, sid: msg.sid };
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Send failed";
        return { success: false, error: message };
      }
    },

    /** Twilio Verify API: send 2FA code (like Twilly). When verifyServiceId is set, use this instead of sendSms with code in body. */
    async sendVerification(to: string): Promise<TwilioSendResult> {
      if (!config.twilio.useReal || !client || !verifyServiceId) {
        return { success: false, error: "Twilio Verify not configured" };
      }
      try {
        const verification = await client.verify.v2
          .services(verifyServiceId)
          .verifications.create({ to, channel: "sms" });
        return { success: verification.status === "pending", sid: verification.sid, error: verification.status !== "pending" ? "Send failed" : undefined };
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Send failed";
        return { success: false, error: message };
      }
    },

    /** Twilio Verify API: check 2FA code. */
    async checkVerification(to: string, code: string): Promise<{ success: boolean; error?: string }> {
      if (!config.twilio.useReal || !client || !verifyServiceId) {
        return { success: false, error: "Twilio Verify not configured" };
      }
      try {
        const check = await client.verify.v2
          .services(verifyServiceId)
          .verificationChecks.create({ to, code });
        return { success: check.valid ?? false, error: check.valid ? undefined : "Invalid code" };
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Verification failed";
        return { success: false, error: message };
      }
    },

    /** Map inbound keyword to smsStatus update and response body */
    handleInboundKeyword(keyword: string): { smsStatus?: SmsStatus; responseBody: string } {
      const k = (keyword || "").trim().toUpperCase();
      if (k === "STOP") {
        return { smsStatus: "opted_out", responseBody: "You have been unsubscribed. Reply START to resubscribe." };
      }
      if (k === "START") {
        return { smsStatus: "active", responseBody: "You are resubscribed. Reply STOP to opt out." };
      }
      if (k === "HELP") {
        return { responseBody: "Statics: Reply STOP to unsubscribe, START to resubscribe. Support: support@statics.example.com" };
      }
      return { responseBody: "" };
    },
  };
}
