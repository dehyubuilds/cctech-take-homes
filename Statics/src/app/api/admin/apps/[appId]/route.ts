import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { getAppRepository, getSubscriptionRepository } from "@/lib/repositories";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const auth = _request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session || !authService.isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { appId } = await params;
  const repo = getAppRepository();
  const app = await repo.getById(appId);
  if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 });
  return NextResponse.json(app);
}

export async function PATCH(
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
  const body = await request.json();
  const appRepo = getAppRepository();
  const subRepo = getSubscriptionRepository();
  const updated = await appRepo.update(appId, {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.slug !== undefined && { slug: body.slug }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.thumbnailUrl !== undefined && { thumbnailUrl: body.thumbnailUrl }),
    ...(body.siteUrl !== undefined && { siteUrl: body.siteUrl }),
    ...(body.status !== undefined && { status: body.status }),
    ...(body.priceCents !== undefined && { priceCents: body.priceCents }),
    ...(body.shareTitle !== undefined && { shareTitle: body.shareTitle }),
    ...(body.shareDescription !== undefined && { shareDescription: body.shareDescription }),
    ...(body.shareImageUrl !== undefined && { shareImageUrl: body.shareImageUrl }),
    ...(body.canonicalUrl !== undefined && { canonicalUrl: body.canonicalUrl }),
  });
  if (!updated) return NextResponse.json({ error: "App not found" }, { status: 404 });

  if (body.status === "inactive") {
    const pausedCount = await subRepo.pauseAllForApp(appId);
    await subRepo.writeSubscriptionStopEntry(appId);
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const auth = _request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session || !authService.isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { appId } = await params;
  const repo = getAppRepository();
  const ok = await repo.delete(appId);
  if (!ok) return NextResponse.json({ error: "App not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
