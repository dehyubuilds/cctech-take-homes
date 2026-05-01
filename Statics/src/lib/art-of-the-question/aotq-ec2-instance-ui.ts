/**
 * EC2 worker instance — UI/API rules for Start / Stop.
 * Start only when fully stopped; Stop only when running (not while pending/stopping).
 */

export function aotqWorkerInstanceActionsFromState(state: string | null | undefined): {
  startAllowed: boolean;
  stopAllowed: boolean;
} {
  if (!state || state === "unknown") {
    return { startAllowed: false, stopAllowed: false };
  }
  return {
    startAllowed: state === "stopped",
    stopAllowed: state === "running",
  };
}

/** Instance is between stable states — poll describe more often and show transitional copy. */
export function aotqWorkerInstanceTransitioning(state: string | null | undefined): boolean {
  return state === "pending" || state === "stopping" || state === "shutting-down";
}

export function aotqWorkerInstanceStatusDescription(state: string | null | undefined): string {
  switch (state) {
    case "running":
      return "Running — the worker VM is up. You can stop it when idle.";
    case "stopped":
      return "Stopped — Start boots the instance; ingest to this worker stays blocked until it is running.";
    case "pending":
      return "Starting — the instance is booting. Start stays disabled; Stop is disabled until the VM is running.";
    case "stopping":
      return "Stopping — wait until the instance is fully stopped before you can start it again.";
    case "shutting-down":
      return "Shutting down — transitional state; refresh in a few seconds.";
    case "terminated":
      return "Terminated — replace the worker instance id in configuration.";
    default:
      return "State unknown — use Refresh or check AWS / IAM.";
  }
}
