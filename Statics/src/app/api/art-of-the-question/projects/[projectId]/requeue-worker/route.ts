import { NextRequest, NextResponse } from "next/server";
import { getAotqSessionUser } from "@/lib/art-of-the-question/aotq-route-auth";
import { requeueProjectSourcesToConfiguredWorker } from "@/lib/art-of-the-question/aotq-video-project-service";

export async function POST(_request: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await getAotqSessionUser(_request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await ctx.params;
  try {
    const { requeued, failed } = await requeueProjectSourcesToConfiguredWorker({
      userId: session.userId,
      projectId,
    });
    return NextResponse.json({ ok: true, requeued, failed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg === "REQUEUE_NOT_EC2_WHISPER") {
      return NextResponse.json(
        { error: "Requeue only applies when transcript backend is EC2 Whisper (worker URL + secret configured)." },
        { status: 400 }
      );
    }
    if (msg === "REQUEUE_LOCAL_WS") {
      return NextResponse.json(
        {
          error:
            "Requeue is not available in Art of the Question local WebSocket mode. Add the source again from the browser so it can register on the socket, or set `artOfTheQuestion.aotqLocalWebSocketMode` to false (or `AOTQ_LOCAL_WEBSOCKET_MODE=0`) to use direct server POST to the worker URL instead.",
        },
        { status: 409 }
      );
    }
    if (msg === "REQUEUE_LAMBDA_CONFIGURED") {
      return NextResponse.json(
        {
          error:
            "Requeue is disabled while Lambda async ingest is configured (mixed backends). Clear media ingest function name or use a project without Lambda-queued sources.",
        },
        { status: 409 }
      );
    }
    if (msg === "EC2_WORKER_STOPPED") {
      return NextResponse.json(
        {
          error:
            "EC2 worker instance is stopped. Start it from this page, then requeue.",
          code: "EC2_WORKER_STOPPED",
        },
        { status: 503 }
      );
    }
    if (msg === "EC2_WORKER_STATUS_UNKNOWN") {
      return NextResponse.json(
        { error: "Could not verify EC2 worker instance state.", code: "EC2_WORKER_STATUS_UNKNOWN" },
        { status: 503 }
      );
    }
    console.error("[aotq/requeue-worker]", e);
    return NextResponse.json({ error: "Requeue failed" }, { status: 500 });
  }
}
