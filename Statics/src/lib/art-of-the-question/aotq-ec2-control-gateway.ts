/**
 * Optional path: describe/start/stop the AOTQ worker EC2 instance via an HTTP API (API Gateway v2 + Lambda)
 * instead of the Next server using IAM credentials directly.
 *
 * Set `AOTQ_EC2_CONTROL_API_URL` (origin, no trailing slash) and `AOTQ_EC2_CONTROL_API_SECRET` (Bearer token).
 * Deploy the stack under `scripts/aotq-ec2-control-api/`.
 */

export class AotqEc2ControlHttpError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly payload: Record<string, unknown>
  ) {
    super(message);
    this.name = "AotqEc2ControlHttpError";
  }
}

export function usesAotqEc2ControlHttpApi(): boolean {
  const base = process.env.AOTQ_EC2_CONTROL_API_URL?.trim() ?? "";
  const secret = process.env.AOTQ_EC2_CONTROL_API_SECRET?.trim() ?? "";
  return Boolean(base && secret);
}

function controlBase(): string {
  return (process.env.AOTQ_EC2_CONTROL_API_URL ?? "").trim().replace(/\/$/, "");
}

function controlSecret(): string {
  return (process.env.AOTQ_EC2_CONTROL_API_SECRET ?? "").trim();
}

function controlUrl(): string {
  return `${controlBase()}/worker/instance`;
}

export async function describeAotqWorkerInstanceViaHttpApi(): Promise<{
  instanceId: string;
  state: string;
} | null> {
  const res = await fetch(controlUrl(), {
    method: "GET",
    headers: { Authorization: `Bearer ${controlSecret()}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) return null;
  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`EC2 control HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("EC2 control: invalid JSON from describe");
  }
  const instanceId = typeof j.instanceId === "string" ? j.instanceId : "";
  const state = typeof j.state === "string" ? j.state : "unknown";
  if (!instanceId) return null;
  return { instanceId, state };
}

export async function postAotqEc2ControlAction(action: "start" | "stop"): Promise<{
  instanceId: string;
  state: string;
  actions: { startAllowed: boolean; stopAllowed: boolean };
}> {
  const res = await fetch(controlUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${controlSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
    signal: AbortSignal.timeout(45_000),
  });
  const text = await res.text().catch(() => "");
  let j: Record<string, unknown> = {};
  try {
    if (text) j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  if (!res.ok) {
    const msg = typeof j.error === "string" ? j.error : `HTTP ${res.status}`;
    throw new AotqEc2ControlHttpError(msg, res.status, j);
  }
  const instanceId = typeof j.instanceId === "string" ? j.instanceId : "";
  const state = typeof j.state === "string" ? j.state : "unknown";
  const actions = j.actions as { startAllowed?: boolean; stopAllowed?: boolean } | undefined;
  return {
    instanceId,
    state,
    actions: {
      startAllowed: Boolean(actions?.startAllowed),
      stopAllowed: Boolean(actions?.stopAllowed),
    },
  };
}
