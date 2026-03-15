import { NextRequest, NextResponse } from "next/server";
import { getTwilioAdapter } from "@/lib/services";
import { getUserRepository } from "@/lib/repositories";

/**
 * Twilio webhook: inbound SMS (STOP, START, HELP, or message).
 * STOP → write opt-out to Dynamo: user.smsStatus = opted_out (do not send SMS to this user).
 * START → user.smsStatus = active (opt back in). HELP → reply with support text.
 * Production: verify Twilio signature.
 */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const body = (form.get("Body") as string) || "";
    const from = (form.get("From") as string) || "";

    const twilio = getTwilioAdapter();
    const keyword = body.trim().toUpperCase();
    const { smsStatus, responseBody } = twilio.handleInboundKeyword(keyword);

    if (smsStatus) {
      const userRepo = getUserRepository();
      const user = await userRepo.getByPhone(from);
      if (user) {
        await userRepo.update(user.userId, { smsStatus });
      }
    }

    if (responseBody) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(responseBody)}</Message></Response>`,
        {
          headers: { "Content-Type": "text/xml" },
        }
      );
    }

    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  } catch (e) {
    console.error("Twilio webhook", e);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
