/**
 * E.164 numbers for users subscribed to Dropflow with verified phone and active SMS.
 * Use from sale/notification jobs to text Dropflow subscribers (same eligibility as subscribe).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAppRepository, getSubscriptionRepository, getUserRepository } from "@/lib/repositories";

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && !phone.trim().startsWith("+")) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.trim().startsWith("+") ? phone.trim() : `+${digits}`;
}

export async function GET(request: NextRequest) {
  const productKey = process.env.DROPFLOW_PRODUCT_API_KEY ?? "";
  const auth = request.headers.get("Authorization") || request.nextUrl.searchParams.get("api_key");
  if (productKey && auth !== `Bearer ${productKey}` && auth !== productKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appRepo = getAppRepository();
  const subRepo = getSubscriptionRepository();
  const userRepo = getUserRepository();

  const app = await appRepo.getBySlug("dropflow");
  if (!app) {
    return NextResponse.json({ numbers: [] });
  }

  const subs = await subRepo.listByApp(app.appId);
  const seen = new Set<string>();

  for (const sub of subs) {
    if (sub.status !== "active") continue;
    const user = await userRepo.getById(sub.userId);
    if (!user || user.smsStatus !== "active") continue;
    if (!user.phoneNumber?.trim() || !user.phoneVerified) continue;
    seen.add(toE164(user.phoneNumber));
  }

  return NextResponse.json({ numbers: [...seen] });
}
