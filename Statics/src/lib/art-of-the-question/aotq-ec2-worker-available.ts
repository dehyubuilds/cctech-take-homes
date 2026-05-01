import {
  describeAotqWorkerInstance,
  getAotqWorkerInstanceId,
  usesAotqEc2ControlHttpApi,
} from "@/lib/art-of-the-question/aotq-ec2-control";
import {
  isAotqWorkerLocalHost,
  useAotqLocalWebSocket,
  useEc2WhisperIngest,
} from "@/lib/art-of-the-question/aotq-ec2-worker-ingest";

const BLOCKING_STATES = new Set(["stopped", "stopping", "shutting-down", "terminated"]);

/**
 * True when Whisper jobs are configured to hit a remote worker and the configured EC2 instance is not usable.
 * Used by GET /worker/instance for UI gating (does not throw on describe failure).
 */
export function aotqEc2InstanceBlocksRemoteWhisper(state: string | null | undefined): boolean {
  if (!state) return false;
  return BLOCKING_STATES.has(state);
}

/**
 * Before enqueueing work to the EC2 worker, ensure the configured instance can accept jobs.
 * Skips when not using EC2 Whisper, when the worker URL is loopback, or when no instance ID is configured.
 */
export async function assertEc2WhisperWorkerAvailableForJobs(): Promise<void> {
  if (useAotqLocalWebSocket()) return;
  if (!useEc2WhisperIngest()) return;
  if (isAotqWorkerLocalHost()) return;
  if (!getAotqWorkerInstanceId() && !usesAotqEc2ControlHttpApi()) return;

  let info: Awaited<ReturnType<typeof describeAotqWorkerInstance>>;
  try {
    info = await describeAotqWorkerInstance();
  } catch {
    throw new Error("EC2_WORKER_STATUS_UNKNOWN");
  }
  if (!info) return;
  if (BLOCKING_STATES.has(info.state)) {
    throw new Error("EC2_WORKER_STOPPED");
  }
}

/**
 * When the deployment uses remote EC2 Whisper, block Ask until the worker instance is running or pending.
 */
export async function assertEc2WhisperWorkerAvailableForAsk(): Promise<void> {
  await assertEc2WhisperWorkerAvailableForJobs();
}
