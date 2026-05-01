import { NextRequest, NextResponse } from "next/server";
import { getAotqSessionUser } from "@/lib/art-of-the-question/aotq-route-auth";
import { extractYoutubePlaylistId } from "@/lib/art-of-the-question/aotq-youtube";
import {
  addYoutubePlaylistSources,
  addYoutubeSource,
  deleteAllProjectSources,
} from "@/lib/art-of-the-question/aotq-video-project-service";

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const session = await getAotqSessionUser(_request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await ctx.params;
  try {
    const { removed } = await deleteAllProjectSources({ userId: session.userId, projectId });
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("[aotq/sources] DELETE all", e);
    return NextResponse.json({ error: "Could not remove sources." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const session = await getAotqSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const youtubeUrl = String(body.youtubeUrl ?? "").trim();
  if (!youtubeUrl) {
    return NextResponse.json({ error: "youtubeUrl required" }, { status: 400 });
  }
  try {
    const playlistId = extractYoutubePlaylistId(youtubeUrl);
    if (playlistId) {
      const {
        sources,
        summary,
        anyQueuedEc2Worker,
        anyQueuedLambda,
        anyLocalWebSocket,
        wsUrl,
        localWebSocketRegistrations,
      } = await addYoutubePlaylistSources({
        userId: session.userId,
        projectId,
        playlistId,
      });
      const ingestMode = anyLocalWebSocket
        ? "local_websocket_async"
        : anyQueuedEc2Worker
          ? "ec2_whisper_async"
          : anyQueuedLambda
            ? "lambda_async"
            : "youtube_captions";
      return NextResponse.json({
        batch: true,
        sources,
        summary,
        queuedLambda: anyQueuedLambda,
        queuedEc2Worker: anyQueuedEc2Worker,
        ingestMode,
        ...(typeof wsUrl === "string" && wsUrl && localWebSocketRegistrations?.length
          ? { wsUrl, localWebSocketRegistrations }
          : {}),
      });
    }

    const { source, queuedLambda, queuedEc2Worker, wsUrl, registerToken, localWsJobId } = await addYoutubeSource({
      userId: session.userId,
      projectId,
      youtubeUrl,
    });
    const ingestMode = localWsJobId
      ? "local_websocket_async"
      : queuedEc2Worker
        ? "ec2_whisper_async"
        : queuedLambda
          ? "lambda_async"
          : "youtube_captions";
    return NextResponse.json({
      source,
      queuedLambda,
      queuedEc2Worker,
      ingestMode,
      ...(localWsJobId && registerToken && wsUrl ? { wsUrl, registerToken, localWsJobId } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (msg === "SOURCE_LIMIT") {
      return NextResponse.json({ error: "Maximum sources per project reached" }, { status: 400 });
    }
    if (msg === "BAD_URL") {
      return NextResponse.json({ error: "Unsupported or invalid YouTube URL" }, { status: 400 });
    }
    if (msg === "DUPLICATE_VIDEO") {
      return NextResponse.json(
        { error: "This video is already in the project (same YouTube ID)." },
        { status: 400 }
      );
    }
    if (msg === "VIDEO_PRIVATE") {
      return NextResponse.json(
        { error: "That YouTube video is private. It cannot be ingested without cookies / access." },
        { status: 400 }
      );
    }
    if (msg === "VIDEO_UNAVAILABLE") {
      return NextResponse.json(
        { error: "That YouTube video is unavailable or was removed." },
        { status: 400 }
      );
    }
    if (msg === "YOUTUBE_DATA_API_KEY_MISSING") {
      return NextResponse.json(
        {
          error:
            "Playlist import needs the YouTube Data API key. Set YOUTUBE_DATA_API_KEY or config.youtubeDataApiKey (same key as other Statics YouTube features).",
        },
        { status: 503 }
      );
    }
    if (msg === "PLAYLIST_EMPTY") {
      return NextResponse.json(
        { error: "No videos found for that playlist (empty, private, or invalid playlist id)." },
        { status: 400 }
      );
    }
    if (msg === "PLAYLIST_NOTHING_TO_INGEST") {
      return NextResponse.json(
        {
          error:
            "No videos from that playlist could be added: every entry was private, removed, or filtered out. Public and unlisted items are kept.",
        },
        { status: 400 }
      );
    }
    if (msg === "PLAYLIST_ALL_DUPLICATES") {
      return NextResponse.json(
        { error: "Every video in that playlist is already in this project." },
        { status: 400 }
      );
    }
    if (msg === "EC2_WORKER_STOPPED") {
      return NextResponse.json(
        {
          error:
            "The transcription EC2 instance is stopped. Open the project page, use Start instance under “Transcription compute”, wait until the state is running, then add your video or playlist again.",
          code: "EC2_WORKER_STOPPED",
        },
        { status: 503 }
      );
    }
    if (msg === "EC2_WORKER_STATUS_UNKNOWN") {
      return NextResponse.json(
        {
          error:
            "Could not verify the transcription EC2 instance (AWS describe failed). Check IAM ec2:DescribeInstances, then retry.",
          code: "EC2_WORKER_STATUS_UNKNOWN",
        },
        { status: 503 }
      );
    }
    console.error("[aotq/sources]", e);
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}
