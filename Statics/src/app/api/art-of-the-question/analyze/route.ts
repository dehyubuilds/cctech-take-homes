import { NextRequest, NextResponse } from "next/server";
import { getAuthService } from "@/lib/services";
import { createInterviewFromTranscript } from "@/lib/art-of-the-question/aotq-service";

/**
 * Creator / admin: submit transcript → LangGraph pipeline → stored interview.
 * V1: admin-only. Wire Stripe or role checks later.
 */
export async function POST(request: NextRequest) {
  const auth = request.headers.get("Authorization");
  const token = auth?.replace("Bearer ", "") ?? null;
  const authService = getAuthService();
  const session = await authService.getSessionUser(token);
  if (!session || !authService.isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? "Untitled interview").trim();
  const transcript = String(body.transcript ?? "").trim();
  if (!transcript) {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

  const source = (body.source as "video_url" | "transcript" | "text") ?? "text";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : undefined;
  const context = typeof body.context === "string" ? body.context : undefined;
  const metadata =
    typeof body.metadata === "object" && body.metadata !== null
      ? (body.metadata as Record<string, string>)
      : undefined;

  const result = await createInterviewFromTranscript({
    title,
    transcript,
    source,
    sourceUrl,
    metadata,
    context,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ interviewId: result.interviewId, bundle: result.bundle });
}
