import {
  DescribeInstancesCommand,
  EC2Client,
  StartInstancesCommand,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";
import {
  describeAotqWorkerInstanceViaHttpApi,
  postAotqEc2ControlAction,
  usesAotqEc2ControlHttpApi,
} from "@/lib/art-of-the-question/aotq-ec2-control-gateway";
import { config } from "@/lib/config";

function ec2Client(region: string) {
  return new EC2Client({
    region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
}

export function getAotqWorkerInstanceId(): string | null {
  const fromEnv = process.env.AOTQ_WORKER_INSTANCE_ID?.trim();
  if (fromEnv) return fromEnv;
  const id = config.artOfTheQuestion.workerInstanceId?.trim();
  return id || null;
}

function workerRegion(): string {
  return config.artOfTheQuestion.workerInstanceRegion?.trim() || config.dynamo.region;
}

export type AotqWorkerInstanceState =
  | "pending"
  | "running"
  | "shutting-down"
  | "terminated"
  | "stopping"
  | "stopped"
  | "unknown";

function normalizeInstanceState(raw: string): AotqWorkerInstanceState {
  if (
    raw === "pending" ||
    raw === "running" ||
    raw === "shutting-down" ||
    raw === "terminated" ||
    raw === "stopping" ||
    raw === "stopped"
  ) {
    return raw;
  }
  return "unknown";
}

export async function describeAotqWorkerInstance(): Promise<{
  instanceId: string;
  state: AotqWorkerInstanceState;
} | null> {
  if (usesAotqEc2ControlHttpApi()) {
    const via = await describeAotqWorkerInstanceViaHttpApi();
    if (!via) return null;
    return { instanceId: via.instanceId, state: normalizeInstanceState(via.state) };
  }
  const id = getAotqWorkerInstanceId();
  if (!id) return null;
  const client = ec2Client(workerRegion());
  const out = await client.send(new DescribeInstancesCommand({ InstanceIds: [id] }));
  const res = out.Reservations?.[0]?.Instances?.[0];
  const raw = res?.State?.Name;
  const state =
    raw === "pending" ||
    raw === "running" ||
    raw === "shutting-down" ||
    raw === "terminated" ||
    raw === "stopping" ||
    raw === "stopped"
      ? raw
      : "unknown";
  return { instanceId: id, state };
}

export async function startAotqWorkerInstance(): Promise<void> {
  if (usesAotqEc2ControlHttpApi()) {
    await postAotqEc2ControlAction("start");
    return;
  }
  const id = getAotqWorkerInstanceId();
  if (!id) throw new Error("NOT_CONFIGURED");
  const client = ec2Client(workerRegion());
  await client.send(new StartInstancesCommand({ InstanceIds: [id] }));
}

export async function stopAotqWorkerInstance(): Promise<void> {
  if (usesAotqEc2ControlHttpApi()) {
    await postAotqEc2ControlAction("stop");
    return;
  }
  const id = getAotqWorkerInstanceId();
  if (!id) throw new Error("NOT_CONFIGURED");
  const client = ec2Client(workerRegion());
  await client.send(new StopInstancesCommand({ InstanceIds: [id] }));
}

export { usesAotqEc2ControlHttpApi };

export function isAotqEc2WorkerControlConfigured(): boolean {
  return Boolean(getAotqWorkerInstanceId()) || usesAotqEc2ControlHttpApi();
}
