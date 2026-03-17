import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { getSubscriptionRepository } from "@/lib/repositories";

export async function POST(request: NextRequest) {
  try {
    const auth = request.headers.get("Authorization");
    const token = auth?.replace("Bearer ", "") ?? null;
    const authService = getAuthService();
    const session = await authService.getSessionUser(token);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const { appId } = body;
    if (!appId) {
      return NextResponse.json({ error: "appId required" }, { status: 400 });
    }
    const subRepo = getSubscriptionRepository();
    const allForUser = await subRepo.listByUser(session.userId);
    const activeForApp = allForUser.filter((s) => s.appId === appId && s.status === "active");
    for (const s of activeForApp) {
      await subRepo.cancel(s.subscriptionId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[unsubscribe]", err);
    return NextResponse.json(
      { error: "Could not unsubscribe. Please try again." },
      { status: 500 }
    );
  }
}
