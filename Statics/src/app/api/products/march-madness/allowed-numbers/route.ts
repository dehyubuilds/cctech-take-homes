/**
 * Returns allowed phone numbers for product "March Madness" (E.164).
 * Used by the March Madness V1 backend (Statics product table / API).
 * Protect with API key or internal-only in production.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAppRepository, getSubscriptionRepository, getUserRepository } from "@/lib/repositories";

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && !phone.trim().startsWith("+")) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.trim().startsWith("+") ? phone.trim() : `+${digits}`;
}

const MARCH_MADNESS_API_KEY = ""; // no key required; hardcoded config

export async function GET(request: NextRequest) {
  const auth = request.headers.get("Authorization") || request.nextUrl.searchParams.get("api_key");
  if (MARCH_MADNESS_API_KEY && auth !== `Bearer ${MARCH_MADNESS_API_KEY}` && auth !== MARCH_MADNESS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appRepo = getAppRepository();
  const subRepo = getSubscriptionRepository();
  const userRepo = getUserRepository();

  const app = await appRepo.getBySlug("daily-march-madness-picks");
  if (!app) {
    return NextResponse.json({ numbers: [] });
  }

  const subs = await subRepo.listByApp(app.appId);
  const numbers: string[] = [];
  for (const sub of subs) {
    const user = await userRepo.getById(sub.userId);
    if (!user || user.smsStatus !== "active") continue;
    if (user.phoneNumber) numbers.push(toE164(user.phoneNumber));
  }

  return NextResponse.json({ numbers });
}
