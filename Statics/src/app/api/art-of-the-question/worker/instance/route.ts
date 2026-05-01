import { NextRequest, NextResponse } from "next/server";
import { getAotqSessionUser } from "@/lib/art-of-the-question/aotq-route-auth";
import { AotqEc2ControlHttpError } from "@/lib/art-of-the-question/aotq-ec2-control-gateway";
import {
  describeAotqWorkerInstance,
  getAotqWorkerInstanceId,
  isAotqEc2WorkerControlConfigured,
  startAotqWorkerInstance,
  stopAotqWorkerInstance,
  usesAotqEc2ControlHttpApi,
} from "@/lib/art-of-the-question/aotq-ec2-control";
import {
  aotqWorkerInstanceActionsFromState,
} from "@/lib/art-of-the-question/aotq-ec2-instance-ui";
import { aotqEc2InstanceBlocksRemoteWhisper } from "@/lib/art-of-the-question/aotq-ec2-worker-available";
import {
  getAotqLocalWorkerUiMode,
  isAotqWorkerLocalHost,
  shouldHideAotqEc2InstanceControls,
  useAotqLocalWebSocket,
  useEc2WhisperIngest,
} from "@/lib/art-of-the-question/aotq-ec2-worker-ingest";

export async function GET(request: NextRequest) {
  const session = await getAotqSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (useAotqLocalWebSocket()) {
    return NextResponse.json({
      configured: true,
      localWorker: true,
      localWorkerMode: "worker_url" as const,
      aotqWebSocketBridge: true,
      instanceId: null,
      state: null,
      actions: { startAllowed: false, stopAllowed: false },
      ec2WhisperRemote: false,
      instanceInhibitsIngest: false,
    });
  }
  const host = request.headers.get("host");
  if (shouldHideAotqEc2InstanceControls(host)) {
    const mode = getAotqLocalWorkerUiMode(host);
    return NextResponse.json({
      configured: true,
      localWorker: true,
      localWorkerMode: mode,
      instanceId: null,
      state: null,
      actions: { startAllowed: false, stopAllowed: false },
      ec2WhisperRemote: false,
      instanceInhibitsIngest: false,
    });
  }
  const id = getAotqWorkerInstanceId();
  const ec2WhisperRemote = useEc2WhisperIngest() && !isAotqWorkerLocalHost();
  if (!isAotqEc2WorkerControlConfigured()) {
    return NextResponse.json({
      configured: false,
      instanceId: null,
      state: null,
      ec2WhisperRemote,
      instanceInhibitsIngest: false,
      ec2ControlViaHttpApi: usesAotqEc2ControlHttpApi(),
    });
  }
  try {
    const info = await describeAotqWorkerInstance();
    const state = info?.state ?? "unknown";
    const actions = aotqWorkerInstanceActionsFromState(state);
    const instanceInhibitsIngest = ec2WhisperRemote && aotqEc2InstanceBlocksRemoteWhisper(state);
    return NextResponse.json({
      configured: true,
      instanceId: info?.instanceId ?? id ?? null,
      state,
      actions,
      ec2WhisperRemote,
      instanceInhibitsIngest,
      ec2ControlViaHttpApi: usesAotqEc2ControlHttpApi(),
    });
  } catch (e) {
    console.error("[aotq/worker/instance] describe failed", e);
    return NextResponse.json({
      configured: true,
      instanceId: id,
      state: null as string | null,
      actions: { startAllowed: false, stopAllowed: false },
      describeError: usesAotqEc2ControlHttpApi()
        ? "Could not read instance state via the EC2 control HTTP API. Check AOTQ_EC2_CONTROL_API_URL, the Lambda logs, and IAM on the control function."
        : "Could not read instance state. Ensure this IAM user can ec2:DescribeInstances on the worker instance.",
      ec2WhisperRemote,
      instanceInhibitsIngest: false,
      ec2ControlViaHttpApi: usesAotqEc2ControlHttpApi(),
    });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAotqSessionUser(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (useAotqLocalWebSocket()) {
    return NextResponse.json(
      {
        error:
          "EC2 start/stop is not used when ingest uses the local WebSocket bridge (same as Dropflow). Start or stop the worker on your machine instead.",
      },
      { status: 400 }
    );
  }
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "").trim().toLowerCase();
  if (action !== "start" && action !== "stop") {
    return NextResponse.json({ error: 'action must be "start" or "stop"' }, { status: 400 });
  }
  const host = request.headers.get("host");
  if (shouldHideAotqEc2InstanceControls(host)) {
    const msg = isAotqWorkerLocalHost()
      ? "EC2 start/stop is disabled while the worker URL points at localhost. Run the worker on this machine instead."
      : "EC2 start/stop is disabled when you open the app on localhost in development. Set AOTQ_FORCE_EC2_INSTANCE_CONTROLS=1 in .env.local if you need these actions against AWS.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  try {
    const before = await describeAotqWorkerInstance();
    if (!before) {
      return NextResponse.json({ error: "Worker instance is not configured." }, { status: 400 });
    }
    if (action === "start") {
      if (before.state === "terminated") {
        return NextResponse.json(
          { error: "This instance is terminated. Replace workerInstanceId in config with a new instance.", state: before.state },
          { status: 409 }
        );
      }
      if (before.state !== "stopped") {
        return NextResponse.json(
          {
            error: `Start only works when the instance is stopped (current state: ${before.state}).`,
            state: before.state,
          },
          { status: 409 }
        );
      }
      await startAotqWorkerInstance();
    } else {
      if (before.state !== "running") {
        return NextResponse.json(
          {
            error: `Stop only works when the instance is running (current state: ${before.state}). Wait if it is still starting (pending) or stopping.`,
            state: before.state,
          },
          { status: 409 }
        );
      }
      await stopAotqWorkerInstance();
    }
    let afterInfo: Awaited<ReturnType<typeof describeAotqWorkerInstance>> = null;
    try {
      afterInfo = await describeAotqWorkerInstance();
    } catch (describeErr) {
      console.warn("[aotq/worker/instance] describe after start/stop", describeErr);
    }
    const st = afterInfo?.state ?? "unknown";
    return NextResponse.json({
      ok: true,
      instanceId: afterInfo?.instanceId ?? getAotqWorkerInstanceId(),
      state: st,
      actions: aotqWorkerInstanceActionsFromState(st),
    });
  } catch (e) {
    if (e instanceof AotqEc2ControlHttpError) {
      const p = e.payload as { error?: string; state?: string };
      return NextResponse.json(
        {
          error: typeof p.error === "string" ? p.error : e.message,
          state: typeof p.state === "string" ? p.state : undefined,
        },
        { status: e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 502 }
      );
    }
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "NOT_CONFIGURED") {
      return NextResponse.json({ error: "EC2 worker instance is not configured in config." }, { status: 400 });
    }
    console.error("[aotq/worker/instance]", e);
    return NextResponse.json(
      {
        error: usesAotqEc2ControlHttpApi()
          ? "EC2 control HTTP API request failed. Check Lambda logs and AOTQ_EC2_CONTROL_API_URL / secret."
          : "EC2 start/stop failed. Check IAM (ec2:StartInstances, ec2:StopInstances) and instance ID.",
      },
      { status: 502 }
    );
  }
}
