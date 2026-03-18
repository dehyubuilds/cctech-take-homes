import { NextRequest, NextResponse } from "next/server";
import { getAppRepository } from "@/lib/repositories";
import { getAuthService } from "@/lib/services";
import type { App, AppListVisibility } from "@/lib/domain";

/** Prevent prerender at build time so we never need AWS credentials during build. */
export const dynamic = "force-dynamic";

function effectiveVisibility(app: App): AppListVisibility {
  if (app.listVisibility != null) return app.listVisibility;
  return app.listed !== false ? "everyone" : "unlisted";
}

function isVisibleToUser(app: App, userEmail: string | null): boolean {
  const vis = effectiveVisibility(app);
  if (vis === "unlisted") return false;
  if (vis === "everyone") return true;
  if (vis === "by_email") {
    if (!userEmail) return false;
    const allowed = app.allowedEmails ?? [];
    const normalized = userEmail.trim().toLowerCase();
    return allowed.some((e) => e.trim().toLowerCase() === normalized);
  }
  return false;
}

export async function GET(request: NextRequest) {
  const repo = getAppRepository();
  const apps = await repo.list("active");

  let userEmail: string | null = null;
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  if (token) {
    const authService = getAuthService();
    const session = await authService.getSessionUser(token);
    if (session?.email) userEmail = session.email;
  }

  const filtered = apps.filter((a) => isVisibleToUser(a, userEmail));
  return NextResponse.json({ apps: filtered });
}
