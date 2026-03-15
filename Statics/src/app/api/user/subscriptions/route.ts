import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { getSubscriptionRepository, getAppRepository } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const subRepo = getSubscriptionRepository();
  const appRepo = getAppRepository();
  const subs = await subRepo.listByUser(session.userId);
  const withApp = await Promise.all(
    subs.map(async (sub) => {
      const app = await appRepo.getById(sub.appId);
      return {
        ...sub,
        app: app ? { name: app.name, slug: app.slug } : null,
      };
    })
  );
  return NextResponse.json({ subscriptions: withApp });
}
