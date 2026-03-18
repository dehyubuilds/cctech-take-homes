import { NextRequest, NextResponse } from "next/server";
import { getAuthService, getTwilioAdapter } from "@/lib/services";
import { getAppRepository, getSubscriptionRepository, getUserRepository } from "@/lib/repositories";
import { config } from "@/lib/config";

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
  const userRepo = getUserRepository();
  const user = await userRepo.getById(session.userId);
  if (!user?.phoneNumber?.trim()) {
    return NextResponse.json(
      { error: "Add a phone number in Profile before subscribing. Messages are sent via SMS." },
      { status: 403 }
    );
  }
  if (!user.phoneVerified) {
    return NextResponse.json(
      { error: "Verify your phone number in Profile before subscribing." },
      { status: 403 }
    );
  }
  const body = await request.json();
  const { appId } = body;
  if (!appId) {
    return NextResponse.json({ error: "appId required" }, { status: 400 });
  }
  const subRepo = getSubscriptionRepository();
  const appRepo = getAppRepository();
  const existing = await subRepo.getByUserAndApp(session.userId, appId);
  if (existing) {
    return NextResponse.json({ subscription: existing });
  }
  const now = new Date().toISOString();
  const sub = {
    subscriptionId: `sub-${session.userId}-${appId}-${Date.now()}`,
    userId: session.userId,
    appId,
    deliveryChannel: "sms" as const,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  };
  await subRepo.create(sub);

  if (config.twilio.useReal && user.phoneNumber) {
    const app = await appRepo.getById(appId);
    const appName = app?.name ?? "this product";
    const twilio = getTwilioAdapter();
    const isDropflow = app?.slug === "dropflow";
    const welcomeBody = isDropflow
      ? `Statics: You're subscribed to ${appName}. You'll get SMS about beats and songs you care about (e.g. when a sale completes). Reply STOP to opt out.`
      : `Statics: You're subscribed to ${appName}. What to expect: one text per day with picks and analysis (spread/total, matchups, start times, short reasons). Your first message will be sent on the next run. Reply STOP to opt out.`;
    await twilio.sendSms(toE164(user.phoneNumber), welcomeBody);
  }

  return NextResponse.json({ subscription: sub });
}
