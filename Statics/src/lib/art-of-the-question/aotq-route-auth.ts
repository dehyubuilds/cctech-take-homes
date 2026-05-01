import { NextResponse, type NextRequest } from "next/server";
import { getAuthService } from "@/lib/services";
import type { SessionUser } from "@/lib/services";

export async function getAotqSessionUser(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  return authService.getSessionUser(token);
}

/** Internal AOTQ tools (e.g. Playlist Triage): signed-in admin only. */
export async function requireAotqAdminSession(
  request: NextRequest
): Promise<{ ok: true; session: SessionUser } | { ok: false; response: NextResponse }> {
  const session = await getAotqSessionUser(request);
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!getAuthService().isAdmin(session)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}
