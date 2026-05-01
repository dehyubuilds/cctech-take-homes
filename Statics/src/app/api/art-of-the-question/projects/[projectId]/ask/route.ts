import { NextRequest, NextResponse } from "next/server";
import { getAotqSessionUser } from "@/lib/art-of-the-question/aotq-route-auth";
import { askVideoProject } from "@/lib/art-of-the-question/aotq-video-project-service";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const session = await getAotqSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
  try {
    const turn = await askVideoProject({ userId: session.userId, projectId, prompt });
    return NextResponse.json({ turn });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg === "NO_CORPUS") {
      return NextResponse.json(
        { error: "No ready transcripts yet. Add YouTube URLs and wait for ingest to complete." },
        { status: 400 }
      );
    }
    if (msg === "EC2_WORKER_STOPPED") {
      return NextResponse.json(
        {
          error:
            "The transcription EC2 instance is stopped. Start it from the project page (Transcription compute → Start instance), then use Ask again.",
          code: "EC2_WORKER_STOPPED",
        },
        { status: 503 }
      );
    }
    if (msg === "EC2_WORKER_STATUS_UNKNOWN") {
      return NextResponse.json(
        {
          error:
            "Could not verify the transcription EC2 instance. Check IAM ec2:DescribeInstances and retry.",
          code: "EC2_WORKER_STATUS_UNKNOWN",
        },
        { status: 503 }
      );
    }
    console.error("[aotq/ask]", e);
    const raw = e instanceof Error ? e.message : String(e);
    const detail =
      process.env.NODE_ENV === "development"
        ? raw.slice(0, 800)
        : "Often Bedrock: enable the model in this AWS account, ensure IAM allows bedrock:InvokeModel on the inference profile, and check AOTQ_BEDROCK_MODEL_ID / timeouts. Server logs include the full error.";
    return NextResponse.json({ error: "Question failed", detail }, { status: 500 });
  }
}
