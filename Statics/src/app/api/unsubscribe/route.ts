import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { getSubscriptionRepository } from "@/lib/repositories";

export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { appId } = body;
  if (!appId) {
    return NextResponse.json({ error: "appId required" }, { status: 400 });
  }
  const subRepo = getSubscriptionRepository();
  const existing = await subRepo.getByUserAndApp(session.userId, appId);
  if (!existing) {
    return NextResponse.json({ ok: true });
  }
  await subRepo.cancel(existing.subscriptionId);
  return NextResponse.json({ ok: true });
}
