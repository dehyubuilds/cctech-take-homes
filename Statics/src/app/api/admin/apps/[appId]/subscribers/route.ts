import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { getSubscriptionRepository } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session || !authService.isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { appId } = await params;
  const subRepo = getSubscriptionRepository();
  const subs = await subRepo.listByApp(appId);
  return NextResponse.json({ count: subs.length });
}
