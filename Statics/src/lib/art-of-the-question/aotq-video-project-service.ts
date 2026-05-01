import { randomBytes, randomUUID } from "crypto";
import { YoutubeTranscript } from "youtube-transcript";
import { getAotqVideoProjectRepository } from "@/lib/art-of-the-question/aotq-video-project-repository";
import type { VideoProject, VideoProjectAskTurn, VideoProjectSource } from "@/lib/art-of-the-question/video-project-types";
import {
  AOTQ_MAX_VIDEO_DURATION_SECONDS,
  assertYoutubeVideoIngestableOrThrow,
  extractYoutubeVideoId,
  fetchYoutubeOEmbed,
  filterYoutubeVideoIdsForIngest,
  listYoutubePlaylistVideoIds,
} from "@/lib/art-of-the-question/aotq-youtube";
import { getAotqTranscriptPlainTextFromS3, putAotqTranscriptJson } from "@/lib/art-of-the-question/aotq-media-s3";
import {
  assertEc2WhisperWorkerAvailableForAsk,
  assertEc2WhisperWorkerAvailableForJobs,
} from "@/lib/art-of-the-question/aotq-ec2-worker-available";
import {
  enqueueAotqEc2WhisperIngest,
  getAotqWorkerUnreachableUserMessage,
  isAotqWorkerLocalHost,
  useAotqLocalWebSocket,
  useEc2WhisperIngest,
} from "@/lib/art-of-the-question/aotq-ec2-worker-ingest";
import { getAotqMediaIngestFunctionName, invokeAotqMediaIngestAsync } from "@/lib/art-of-the-question/aotq-lambda-ingest";
import { runProjectQuestionAnswer, type AotqAskPriorTurn } from "@/lib/art-of-the-question/aotq-project-bedrock";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { config } from "@/lib/config";
import { docClient, getTable } from "@/lib/dynamodb";
import { AOTQ_MAX_SOURCES_PER_PROJECT } from "@/lib/art-of-the-question/aotq-video-project-limits";

const MAX_SOURCES = AOTQ_MAX_SOURCES_PER_PROJECT;

export type AddYoutubeSourceResult = {
  source: VideoProjectSource;
  queuedLambda: boolean;
  queuedEc2Worker: boolean;
  wsUrl?: string;
  registerToken?: string;
  localWsJobId?: string;
};
const INLINE_TRANSCRIPT_MAX = 350_000;

function nowIso() {
  return new Date().toISOString();
}

function fmtTs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export async function createVideoProject(userId: string, name: string): Promise<VideoProject> {
  const repo = getAotqVideoProjectRepository();
  const projectId = `vp_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const t = nowIso();
  const project: VideoProject = {
    projectId,
    userId,
    name: name.trim() || "Untitled project",
    createdAt: t,
    updatedAt: t,
  };
  await repo.putProject(project);
  return project;
}

export async function assertProjectOwner(userId: string, projectId: string): Promise<VideoProject> {
  const repo = getAotqVideoProjectRepository();
  const p = await repo.getProject(projectId);
  if (!p || p.userId !== userId) {
    throw new Error("NOT_FOUND");
  }
  return p;
}

const MAX_PROJECT_NAME_LEN = 200;

export async function renameVideoProject(params: {
  userId: string;
  projectId: string;
  name: string;
}): Promise<VideoProject> {
  const p = await assertProjectOwner(params.userId, params.projectId);
  let name = params.name.trim() || "Untitled project";
  if (name.length > MAX_PROJECT_NAME_LEN) {
    name = name.slice(0, MAX_PROJECT_NAME_LEN);
  }
  const updated: VideoProject = { ...p, name, updatedAt: nowIso() };
  await getAotqVideoProjectRepository().putProject(updated);
  return updated;
}

export async function deleteProjectSource(params: {
  userId: string;
  projectId: string;
  sourceId: string;
}): Promise<void> {
  await assertProjectOwner(params.userId, params.projectId);
  const repo = getAotqVideoProjectRepository();
  const row = await repo.getSource(params.projectId, params.sourceId);
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  await repo.deleteSource(params.projectId, params.sourceId);
  await repo.deleteAllAskTurnsForProject(params.projectId);
}

/** Deletes every source row; clears all Ask turns (same as single-source delete). */
export async function deleteAllProjectSources(params: { userId: string; projectId: string }): Promise<{ removed: number }> {
  await assertProjectOwner(params.userId, params.projectId);
  const repo = getAotqVideoProjectRepository();
  const sources = await repo.listSources(params.projectId);
  for (const s of sources) {
    await repo.deleteSource(params.projectId, s.sourceId);
  }
  if (sources.length > 0) {
    await repo.deleteAllAskTurnsForProject(params.projectId);
  }
  return { removed: sources.length };
}

export async function addYoutubeSource(params: {
  userId: string;
  projectId: string;
  youtubeUrl: string;
}): Promise<AddYoutubeSourceResult> {
  const { userId, projectId, youtubeUrl } = params;
  await assertProjectOwner(userId, projectId);
  const repo = getAotqVideoProjectRepository();
  const existing = await repo.listSources(projectId);
  if (existing.length >= MAX_SOURCES) {
    throw new Error("SOURCE_LIMIT");
  }
  const videoId = extractYoutubeVideoId(youtubeUrl);
  if (!videoId) {
    throw new Error("BAD_URL");
  }
  if (existing.some((s) => s.videoId === videoId)) {
    throw new Error("DUPLICATE_VIDEO");
  }
  await assertYoutubeVideoIngestableOrThrow(videoId);
  const sourceId = randomUUID();
  const t = nowIso();
  const base: VideoProjectSource = {
    sourceId,
    projectId,
    userId,
    youtubeUrl: youtubeUrl.trim(),
    videoId,
    status: "pending",
    createdAt: t,
    updatedAt: t,
  };
  await repo.putSource(base);

  const tableName = getTable("aotq");
  let queuedLambda = false;
  try {
    queuedLambda = await invokeAotqMediaIngestAsync({
      projectId,
      sourceId,
      userId,
      youtubeUrl: base.youtubeUrl,
      videoId,
      tableName,
    });
  } catch (e) {
    console.error("[aotq] Lambda ingest invoke failed; falling back to inline/EC2 path", e);
  }
  if (queuedLambda) {
    await repo.putSource({ ...base, status: "processing", updatedAt: nowIso() });
    return { source: { ...base, status: "processing" }, queuedLambda: true, queuedEc2Worker: false };
  }

  if (useAotqLocalWebSocket()) {
    await repo.putSource({ ...base, status: "processing", updatedAt: nowIso() });
    const registerToken = randomBytes(24).toString("hex");
    const localWsJobId = `aotq-ws-${Date.now()}-${randomBytes(6).toString("hex")}`;
    const runLlm =
      process.env.AOTQ_RUN_LLM_AFTER_TRANSCRIBE === "1" ||
      Boolean(config.artOfTheQuestion.runLlmAfterTranscribe);
    try {
      await docClient.send(
        new PutCommand({
          TableName: config.youtubeImport.localWsJobsTable,
          Item: {
            jobId: localWsJobId,
            jobKind: "aotq_whisper",
            jobStatus: "AWAITING_REGISTER",
            registerToken,
            projectId,
            sourceId,
            userId,
            youtubeUrl: base.youtubeUrl,
            videoId,
            tableName,
            runLlmAfterTranscribe: runLlm,
          },
        })
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const cur = await repo.getSource(projectId, sourceId);
      if (cur) {
        await repo.putSource({
          ...cur,
          status: "error",
          errorMessage: msg.includes("ResourceNotFoundException")
            ? "Local WebSocket jobs table missing or wrong name (`config.youtubeImport.localWsJobsTable`)."
            : msg.slice(0, 500),
          updatedAt: nowIso(),
        });
      }
      const after = await repo.getSource(projectId, sourceId);
      return {
        source: after!,
        queuedLambda: false,
        queuedEc2Worker: false,
      };
    }
    const cur = await repo.getSource(projectId, sourceId);
    return {
      source: cur!,
      queuedLambda: false,
      queuedEc2Worker: false,
      wsUrl: config.youtubeImport.localWebSocketUrl,
      registerToken,
      localWsJobId,
    };
  }

  if (useEc2WhisperIngest()) {
    try {
      await assertEc2WhisperWorkerAvailableForJobs();
    } catch (e) {
      await repo.deleteSource(projectId, sourceId);
      throw e;
    }
    await repo.putSource({ ...base, status: "processing", updatedAt: nowIso() });
    try {
      await enqueueAotqEc2WhisperIngest({
        projectId,
        sourceId,
        userId,
        youtubeUrl: base.youtubeUrl,
        videoId,
        tableName,
      });
      const cur = await repo.getSource(projectId, sourceId);
      return { source: cur!, queuedLambda: false, queuedEc2Worker: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Worker queue failed";
      const cur = await repo.getSource(projectId, sourceId);
      if (cur) {
        await repo.putSource({
          ...cur,
          status: "error",
          errorMessage:
            msg.includes("fetch failed") || msg.includes("timeout")
              ? getAotqWorkerUnreachableUserMessage()
              : msg,
          updatedAt: nowIso(),
        });
      }
      const after = await repo.getSource(projectId, sourceId);
      return { source: after!, queuedLambda: false, queuedEc2Worker: false };
    }
  }

  await runIngestTranscriptSync(sourceId, projectId, userId, base.youtubeUrl, videoId);
  const done = await repo.getSource(projectId, sourceId);
  return { source: done!, queuedLambda: false, queuedEc2Worker: false };
}

export async function addYoutubePlaylistSources(params: {
  userId: string;
  projectId: string;
  playlistId: string;
}): Promise<{
  sources: VideoProjectSource[];
  summary: {
    playlistId: string;
    fetchedFromApi: number;
    afterVisibilityFilter: number;
    added: number;
    skippedDuplicate: number;
    skippedPrivate: number;
    skippedDeleted: number;
    skippedLimit: boolean;
  };
  anyQueuedEc2Worker: boolean;
  anyQueuedLambda: boolean;
  anyLocalWebSocket: boolean;
  wsUrl?: string;
  localWebSocketRegistrations?: { sourceId: string; localWsJobId: string; registerToken: string }[];
}> {
  const { userId, projectId, playlistId } = params;
  await assertProjectOwner(userId, projectId);
  const repo = getAotqVideoProjectRepository();
  const existing = await repo.listSources(projectId);
  const remaining = MAX_SOURCES - existing.length;
  if (remaining <= 0) {
    throw new Error("SOURCE_LIMIT");
  }

  const fetchBudget = Math.min(Math.max(remaining * 4, 50), 200);
  const rawIds = await listYoutubePlaylistVideoIds(playlistId, fetchBudget);
  if (rawIds.length === 0) {
    throw new Error("PLAYLIST_EMPTY");
  }
  const { ingestable: videoIds, skippedPrivate, skippedDeleted } = await filterYoutubeVideoIdsForIngest(rawIds);
  if (videoIds.length === 0) {
    throw new Error("PLAYLIST_NOTHING_TO_INGEST");
  }

  const sources: VideoProjectSource[] = [];
  let skippedDuplicate = 0;
  let skippedLimit = false;
  let anyQueuedEc2Worker = false;
  let anyQueuedLambda = false;
  let anyLocalWebSocket = false;
  let batchWsUrl: string | undefined;
  const localWebSocketRegistrations: { sourceId: string; localWsJobId: string; registerToken: string }[] = [];
  let slotsUsed = existing.length;

  for (const videoId of videoIds) {
    if (slotsUsed >= MAX_SOURCES) {
      skippedLimit = true;
      break;
    }
    const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    try {
      const { source, queuedLambda, queuedEc2Worker, wsUrl, registerToken, localWsJobId } = await addYoutubeSource({
        userId,
        projectId,
        youtubeUrl,
      });
      sources.push(source);
      slotsUsed += 1;
      if (queuedEc2Worker) anyQueuedEc2Worker = true;
      if (queuedLambda) anyQueuedLambda = true;
      if (localWsJobId && registerToken && wsUrl) {
        anyLocalWebSocket = true;
        batchWsUrl = wsUrl;
        localWebSocketRegistrations.push({ sourceId: source.sourceId, localWsJobId, registerToken });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "DUPLICATE_VIDEO") {
        skippedDuplicate += 1;
        continue;
      }
      if (msg === "SOURCE_LIMIT") {
        skippedLimit = true;
        break;
      }
      throw e;
    }
  }

  if (sources.length === 0 && skippedDuplicate > 0 && !skippedLimit) {
    throw new Error("PLAYLIST_ALL_DUPLICATES");
  }

  return {
    sources,
    summary: {
      playlistId,
      fetchedFromApi: rawIds.length,
      afterVisibilityFilter: videoIds.length,
      added: sources.length,
      skippedDuplicate,
      skippedPrivate,
      skippedDeleted,
      skippedLimit,
    },
    anyQueuedEc2Worker,
    anyQueuedLambda,
    anyLocalWebSocket,
    ...(anyLocalWebSocket && batchWsUrl
      ? { wsUrl: batchWsUrl, localWebSocketRegistrations }
      : {}),
  };
}

async function runIngestTranscriptSync(
  sourceId: string,
  projectId: string,
  userId: string,
  youtubeUrl: string,
  videoId: string
): Promise<void> {
  const repo = getAotqVideoProjectRepository();
  const cur0 = await repo.getSource(projectId, sourceId);
  if (!cur0) return;
  await repo.putSource({ ...cur0, status: "processing", updatedAt: nowIso() });

  const oembed = await fetchYoutubeOEmbed(youtubeUrl);
  let segments: { text: string; offset: number; duration?: number }[];
  try {
    segments = await YoutubeTranscript.fetchTranscript(videoId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Transcript fetch failed";
    const cur = await repo.getSource(projectId, sourceId);
    if (cur) {
      await repo.putSource({
        ...cur,
        status: "error",
        errorMessage: msg,
        title: oembed?.title,
        channelTitle: oembed?.author_name,
        updatedAt: nowIso(),
      });
    }
    return;
  }

  if (!segments.length) {
    const cur = await repo.getSource(projectId, sourceId);
    if (cur) {
      await repo.putSource({
        ...cur,
        status: "error",
        errorMessage: "Empty transcript (no caption segments).",
        title: oembed?.title,
        channelTitle: oembed?.author_name,
        updatedAt: nowIso(),
      });
    }
    return;
  }

  const last = segments[segments.length - 1]!;
  const approxEndSec = (last.offset + (last.duration ?? 0)) / 1000;
  if (approxEndSec > AOTQ_MAX_VIDEO_DURATION_SECONDS) {
    const cur = await repo.getSource(projectId, sourceId);
    if (cur) {
      await repo.putSource({
        ...cur,
        status: "error",
        errorMessage: `Video exceeds maximum length (${AOTQ_MAX_VIDEO_DURATION_SECONDS / 60} minutes).`,
        title: oembed?.title,
        channelTitle: oembed?.author_name,
        updatedAt: nowIso(),
      });
    }
    return;
  }

  const lines = segments.map((s) => {
    const start = fmtTs(s.offset);
    const end = fmtTs(s.offset + (s.duration ?? 0));
    return `[${start}–${end}] ${s.text}`;
  });
  const plainText = lines.join("\n");
  const payload = JSON.stringify({ videoId, segments, plainText, youtubeUrl });

  let transcriptS3Key: string | undefined;
  let transcriptText: string | undefined;
  let transcriptPreview = plainText.slice(0, 500);

  const s3Key = `aotq/${userId}/${projectId}/${sourceId}/transcript.json`;
  let uploaded: { bucket: string; key: string } | null = null;
  try {
    uploaded = await putAotqTranscriptJson(s3Key, payload);
  } catch (e) {
    console.error("[aotq] S3 transcript upload failed; using inline Dynamo text only", e);
  }
  if (uploaded) {
    transcriptS3Key = uploaded.key;
  } else if (plainText.length <= INLINE_TRANSCRIPT_MAX) {
    transcriptText = plainText;
  } else {
    transcriptPreview = `${plainText.slice(0, 400)}… [truncated — configure AOTQ_MEDIA_BUCKET for full storage]`;
    transcriptText = plainText.slice(0, INLINE_TRANSCRIPT_MAX);
  }

  const cur = await repo.getSource(projectId, sourceId);
  if (!cur) return;
  await repo.putSource({
    ...cur,
    status: "ready",
    title: oembed?.title,
    channelTitle: oembed?.author_name,
    durationSeconds: Math.round(approxEndSec),
    transcriptS3Key,
    transcriptText,
    transcriptPreview,
    errorMessage: undefined,
    updatedAt: nowIso(),
  });
}

export async function buildProjectCorpus(userId: string, projectId: string): Promise<string> {
  await assertProjectOwner(userId, projectId);
  const repo = getAotqVideoProjectRepository();
  const ready = (await repo.listSources(projectId)).filter((s) => s.status === "ready");
  /** One corpus block per YouTube video (oldest source wins) so duplicate rows do not double tokens or bias the model. */
  const seenVideoIds = new Set<string>();
  const sources: typeof ready = [];
  for (const s of ready) {
    if (seenVideoIds.has(s.videoId)) continue;
    seenVideoIds.add(s.videoId);
    sources.push(s);
  }
  const parts: string[] = [];
  for (const s of sources) {
    const header = `### ${s.title ?? s.videoId} (${s.videoId})\n`;
    let body = (s.transcriptText ?? "").trim();
    if (!body && s.transcriptS3Key) {
      const fromS3 = await getAotqTranscriptPlainTextFromS3(s.transcriptS3Key);
      body = (fromS3 ?? "").trim();
    }
    if (!body) {
      body = (s.transcriptPreview ?? "").trim();
    }
    parts.push(header + body);
  }
  return parts.join("\n\n");
}

export async function askVideoProject(params: {
  userId: string;
  projectId: string;
  prompt: string;
}): Promise<VideoProjectAskTurn> {
  const { userId, projectId, prompt } = params;
  const project = await assertProjectOwner(userId, projectId);
  await assertEc2WhisperWorkerAvailableForAsk();
  const corpus = await buildProjectCorpus(userId, projectId);
  if (!corpus.trim()) {
    throw new Error("NO_CORPUS");
  }
  const repo = getAotqVideoProjectRepository();
  const existingAsks = await repo.listAskTurns(projectId, 80);
  const priorTurns: AotqAskPriorTurn[] = [...existingAsks]
    .reverse()
    .map((t) => ({ prompt: t.prompt, answer: t.answer }));
  const answer = await runProjectQuestionAnswer({
    projectName: project.name,
    corpus,
    userQuestion: prompt.trim(),
    priorTurns,
  });
  const askId = randomUUID();
  const t = nowIso();
  const row: VideoProjectAskTurn = {
    askId,
    projectId,
    userId,
    prompt: prompt.trim(),
    answer,
    createdAt: t,
  };
  await repo.putAskTurn(row);
  return row;
}

/**
 * Re-POSTs Whisper ingest for every `pending` / `processing` source using the **current** worker URL
 * (`AOTQ_WORKER_API_BASE_URL` / config). Use after switching from a local worker to EC2 (stop local `./run.sh` first
 * to avoid duplicate in-flight jobs). Disabled when Lambda async ingest is configured (ambiguous backend).
 */
export async function requeueProjectSourcesToConfiguredWorker(params: {
  userId: string;
  projectId: string;
}): Promise<{ requeued: number; failed: { sourceId: string; error: string }[] }> {
  const { userId, projectId } = params;
  await assertProjectOwner(userId, projectId);
  if (useAotqLocalWebSocket()) {
    throw new Error("REQUEUE_LOCAL_WS");
  }
  if (!useEc2WhisperIngest()) {
    throw new Error("REQUEUE_NOT_EC2_WHISPER");
  }
  if (getAotqMediaIngestFunctionName()) {
    throw new Error("REQUEUE_LAMBDA_CONFIGURED");
  }
  if (!isAotqWorkerLocalHost()) {
    await assertEc2WhisperWorkerAvailableForJobs();
  }
  const repo = getAotqVideoProjectRepository();
  const sources = await repo.listSources(projectId);
  const targets = sources.filter((s) => s.status === "pending" || s.status === "processing");
  if (targets.length === 0) {
    return { requeued: 0, failed: [] };
  }
  const tableName = getTable("aotq");
  const failed: { sourceId: string; error: string }[] = [];
  let requeued = 0;
  for (const s of targets) {
    try {
      await repo.putSource({
        ...s,
        status: "processing",
        errorMessage: undefined,
        updatedAt: nowIso(),
      });
      await enqueueAotqEc2WhisperIngest({
        projectId,
        sourceId: s.sourceId,
        userId,
        youtubeUrl: s.youtubeUrl,
        videoId: s.videoId,
        tableName,
      });
      requeued += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push({ sourceId: s.sourceId, error: msg.slice(0, 400) });
      const cur = await repo.getSource(projectId, s.sourceId);
      if (cur) {
        await repo.putSource({
          ...cur,
          status: "error",
          errorMessage:
            msg.includes("fetch failed") || msg.includes("timeout")
              ? getAotqWorkerUnreachableUserMessage()
              : msg.slice(0, 500),
          updatedAt: nowIso(),
        });
      }
    }
  }
  return { requeued, failed };
}
