import { config } from "@/lib/config";

type TranscriptBackend = "youtube_captions" | "ec2_whisper";

/**
 * Local / preview only: set in `.env.local` (not Netlify) to hit a worker on `http://127.0.0.1:…`
 * without changing `config.ts`. Production omits these and uses `config.artOfTheQuestion`.
 */
function transcriptBackendOverride(): TranscriptBackend | null {
  const v = process.env.AOTQ_TRANSCRIPT_BACKEND?.trim().toLowerCase();
  if (v === "ec2_whisper" || v === "youtube_captions") return v;
  return null;
}

function effectiveTranscriptBackend(): TranscriptBackend {
  return transcriptBackendOverride() ?? (config.artOfTheQuestion.transcriptBackend as TranscriptBackend);
}

function workerBaseUrl(): string | null {
  const fromEnv = process.env.AOTQ_WORKER_API_BASE_URL?.trim();
  const fromConfig = config.artOfTheQuestion.workerApiBaseUrl?.trim();
  return (fromEnv || fromConfig || "").replace(/\/$/, "") || null;
}

/** True when the configured worker origin is this machine — EC2 start/stop does not apply. */
export function isAotqWorkerLocalHost(): boolean {
  const base = workerBaseUrl();
  if (!base) return false;
  try {
    const u = new URL(base);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return false;
  }
}

function devRequestHostIsLoopback(hostHeader: string | null | undefined): boolean {
  const host = (hostHeader ?? "").split(":")[0]?.toLowerCase() ?? "";
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/**
 * Why the Art of the Question UI hides EC2 start/stop.
 * - `worker_url`: AOTQ_WORKER_API_BASE_URL (or config fallback) is loopback.
 * - `dev_host`: `next dev` and the browser opened the app on localhost, so we avoid touching real EC2 while developing.
 * Set AOTQ_FORCE_EC2_INSTANCE_CONTROLS=1 in .env.local to show EC2 controls anyway (e.g. test Start/Stop from local Next).
 */
export type AotqLocalWorkerUiMode = "none" | "worker_url" | "dev_host";

export function getAotqLocalWorkerUiMode(hostHeader: string | null): AotqLocalWorkerUiMode {
  if (process.env.AOTQ_FORCE_EC2_INSTANCE_CONTROLS?.trim() === "1") return "none";
  if (isAotqWorkerLocalHost()) return "worker_url";
  if (process.env.NODE_ENV === "development" && devRequestHostIsLoopback(hostHeader)) return "dev_host";
  return "none";
}

export function shouldHideAotqEc2InstanceControls(hostHeader: string | null): boolean {
  return getAotqLocalWorkerUiMode(hostHeader) !== "none";
}

/**
 * User-facing hint when enqueue to the worker fails (network / timeout).
 * Does not use the request Host header — safe from API routes and services.
 */
export function getAotqWorkerUnreachableUserMessage(): string {
  if (isAotqWorkerLocalHost()) {
    return "Could not reach the transcription worker on this machine. Run ./run.sh from scripts/aotq-ec2-worker (with your env exports), confirm the port matches AOTQ_WORKER_API_BASE_URL, and ensure AOTQ_WORKER_API_SECRET matches the worker bearer token.";
  }
  if (process.env.NODE_ENV === "development") {
    return "Could not reach the transcription worker. next dev is still calling the worker URL from config (often a cloud IP). Add to .env.local: AOTQ_WORKER_API_BASE_URL=http://127.0.0.1:8787 and AOTQ_WORKER_API_SECRET matching the worker, start the local worker, restart next dev — or start the cloud worker that config points to.";
  }
  return "Could not reach the transcription worker. Start the EC2 worker (or check Elastic IP / HTTPS) and try again.";
}

function workerSecret(): string | null {
  const fromEnv = process.env.AOTQ_WORKER_API_SECRET?.trim();
  const fromConfig = config.artOfTheQuestion.workerApiSharedSecret?.trim();
  return (fromEnv || fromConfig || "") || null;
}

export function useEc2WhisperIngest(): boolean {
  return (
    effectiveTranscriptBackend() === "ec2_whisper" &&
    Boolean(workerBaseUrl()) &&
    Boolean(workerSecret())
  );
}

/**
 * When true, adding a source writes a row in the **same** Dynamo jobs table as Dropflow local YouTube import
 * (`config.youtubeImport.localWsJobsTable`) and returns `wsUrl` / `registerToken` for the browser. Your machine runs
 * `scripts/local-youtube-import-worker/worker/run_worker.py`, which forwards ingest to `POST /ingest` on the
 * AoTQ worker.
 *
 * **Default:** if `youtubeImport` local WebSocket is fully configured and `transcriptBackend` is `ec2_whisper`,
 * AoTQ uses the bridge (same as Dropflow) so the Next.js server never has to reach `127.0.0.1:8787` (which fails on
 * Netlify / remote hosts). Opt out with `artOfTheQuestion.aotqLocalWebSocketMode: false` or env `AOTQ_LOCAL_WEBSOCKET_MODE=0`.
 */
export function useAotqLocalWebSocket(): boolean {
  if (effectiveTranscriptBackend() !== "ec2_whisper") return false;
  const env = process.env.AOTQ_LOCAL_WEBSOCKET_MODE?.trim().toLowerCase();
  if (env === "0" || env === "false" || env === "off") return false;
  const { localWebSocketMode, localWsJobsTable, localWebSocketUrl } = config.youtubeImport;
  if (!localWebSocketMode || !localWsJobsTable || !localWebSocketUrl) return false;
  if (env === "1" || env === "true" || env === "on") return true;
  if (config.artOfTheQuestion.aotqLocalWebSocketMode === false) return false;
  // Default when Dropflow WS is wired: bridge on (avoids Next.js POST to loopback from remote hosts).
  return true;
}

/**
 * Enqueue Whisper (or full pipeline) on the EC2 worker. Worker should accept the job,
 * return 202 quickly, then update Dynamo `aotq` table for the source when done.
 *
 * Reference implementation: `scripts/aotq-ec2-worker/` (FastAPI + yt-dlp + faster-whisper).
 */
export async function enqueueAotqEc2WhisperIngest(payload: {
  projectId: string;
  sourceId: string;
  userId: string;
  youtubeUrl: string;
  videoId: string;
  tableName: string;
}): Promise<void> {
  const base = workerBaseUrl();
  const secret = workerSecret();
  if (!base || !secret) {
    throw new Error("WORKER_NOT_CONFIGURED");
  }
  const url = `${base}/ingest`;
  const runLlm =
    process.env.AOTQ_RUN_LLM_AFTER_TRANSCRIBE === "1" ||
    Boolean(config.artOfTheQuestion.runLlmAfterTranscribe);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ ...payload, runLlmAfterTranscribe: runLlm }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Worker ingest HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
}
