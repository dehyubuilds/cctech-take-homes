import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { getAppRepository } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session || !authService.isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const repo = getAppRepository();
  const apps = await repo.list();
  return NextResponse.json({ apps });
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session || !authService.isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json();
  const now = new Date().toISOString();
  const app = {
    appId: `app-${Date.now()}`,
    name: body.name ?? "New App",
    slug: (body.slug ?? body.name?.toLowerCase().replace(/\s+/g, "-")) ?? "new-app",
    description: body.description ?? "",
    thumbnailUrl: body.thumbnailUrl ?? "",
    siteUrl: body.siteUrl ?? `/app/${body.slug || "new-app"}`,
    status: (body.status as "active" | "inactive" | "draft") ?? "draft",
    priceCents: typeof body.priceCents === "number" ? body.priceCents : 0,
    shareTitle: body.shareTitle ?? body.name ?? "App",
    shareDescription: body.shareDescription ?? "",
    shareImageUrl: body.shareImageUrl ?? "",
    canonicalUrl: body.canonicalUrl ?? "",
    createdBy: session.userId,
    createdAt: now,
    updatedAt: now,
  };
  const repo = getAppRepository();
  await repo.create(app);
  return NextResponse.json(app);
}
