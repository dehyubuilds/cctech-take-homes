import { NextRequest, NextResponse } from "next/server";
import { getAotqSessionUser } from "@/lib/art-of-the-question/aotq-route-auth";
import { deleteProjectSource } from "@/lib/art-of-the-question/aotq-video-project-service";

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string; sourceId: string }> }
) {
  const session = await getAotqSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId, sourceId } = await ctx.params;
  try {
    await deleteProjectSource({
      userId: session.userId,
      projectId,
      sourceId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("[aotq/sources DELETE]", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
