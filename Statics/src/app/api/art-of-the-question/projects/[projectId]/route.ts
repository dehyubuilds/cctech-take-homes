import { NextRequest, NextResponse } from "next/server";
import { getAotqVideoProjectRepository } from "@/lib/art-of-the-question/aotq-video-project-repository";
import { getAotqSessionUser } from "@/lib/art-of-the-question/aotq-route-auth";
import {
  isAotqWorkerLocalHost,
  useAotqLocalWebSocket,
  useEc2WhisperIngest,
} from "@/lib/art-of-the-question/aotq-ec2-worker-ingest";
import { getAotqMediaIngestFunctionName } from "@/lib/art-of-the-question/aotq-lambda-ingest";
import { assertProjectOwner, renameVideoProject } from "@/lib/art-of-the-question/aotq-video-project-service";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const session = await getAotqSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await ctx.params;
  try {
    await assertProjectOwner(session.userId, projectId);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const repo = getAotqVideoProjectRepository();
  const project = await repo.getProject(projectId);
  const sources = await repo.listSources(projectId);
  /**
   * Always return stored Q&A for the UI. Do not delete ask rows on GET — clearing history belonged only to
   * explicit source-delete flows (`deleteProjectSource` / `deleteAllProjectSources`). A read must not wipe data.
   */
  const asks = (await repo.listAskTurns(projectId)).slice(0, 20);
  const requeueStuckCount = sources.filter((s) => s.status === "pending" || s.status === "processing").length;
  const requeueToWorkerAvailable =
    useEc2WhisperIngest() &&
    !useAotqLocalWebSocket() &&
    !getAotqMediaIngestFunctionName() &&
    requeueStuckCount > 0;
  return NextResponse.json({
    project,
    sources,
    asks,
    requeueStuckCount,
    requeueToWorkerAvailable,
    /** Hint for UI: worker URL is loopback — requeue still hits local worker unless env is changed + Next restarted. */
    requeueWorkerUrlIsLocalhost: isAotqWorkerLocalHost(),
  });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const session = await getAotqSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "");
  try {
    const project = await renameVideoProject({
      userId: session.userId,
      projectId,
      name,
    });
    return NextResponse.json({ project });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("[aotq/projects PATCH]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const session = await getAotqSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await ctx.params;
  try {
    await assertProjectOwner(session.userId, projectId);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    await getAotqVideoProjectRepository().deleteProject(projectId, session.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[aotq/projects DELETE]", e);
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
