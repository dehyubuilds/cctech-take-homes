#!/usr/bin/env bash
# Start Art of the Question local ingest + the shared Dropflow/AoTQ WebSocket bridge.
#
# Same WebSocket URL, jobs table, and run_worker.py as Dropflow YouTube import.
# AoTQ additionally needs the FastAPI worker (POST /ingest) — run_worker forwards
# jobKind=aotq_whisper jobs to AOTQ_LOCAL_WORKER_INTERNAL_URL (default http://127.0.0.1:8787).
#
# Prereqs:
#   - config.ts: youtubeImport.localWebSocketMode + artOfTheQuestion.aotqLocalWebSocketMode,
#     transcriptBackend ec2_whisper, table + wss URL from SAM.
#   - scripts/aotq-ec2-worker/.env (AOTQ_WORKER_BEARER_TOKEN matches workerApiSharedSecret, AWS_*, bucket).
#   - scripts/local-youtube-import-worker/worker/.env (JOBS_TABLE, AWS_APIGW_WS_MANAGEMENT_ENDPOINT, …).
#
# Usage:
#   chmod +x start-local-bridge-with-aotq.sh
#   ./start-local-bridge-with-aotq.sh
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_DIR="$SCRIPT_DIR/worker"
AOTQ_DIR="$(cd "$SCRIPT_DIR/../aotq-ec2-worker" && pwd)"
AOTQ_PORT="${AOTQ_WORKER_PORT:-8787}"
AOTQ_HOST="${AOTQ_WORKER_HOST:-127.0.0.1}"

if [[ ! -d "$AOTQ_DIR" || ! -f "$AOTQ_DIR/app/main.py" ]]; then
  echo "Expected AoTQ worker at: $AOTQ_DIR"
  exit 1
fi
if [[ ! -x "$BRIDGE_DIR/.venv/bin/python" ]]; then
  echo "Missing bridge venv: $BRIDGE_DIR/.venv (see worker README)"
  exit 1
fi
if [[ ! -x "$AOTQ_DIR/.venv/bin/python" ]]; then
  echo "Missing AoTQ venv: $AOTQ_DIR/.venv"
  echo "  cd \"$AOTQ_DIR\" && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

UVICORN_PID=""
cleanup() {
  if [[ -n "${UVICORN_PID}" ]] && kill -0 "${UVICORN_PID}" 2>/dev/null; then
    kill "${UVICORN_PID}" 2>/dev/null || true
    wait "${UVICORN_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd "$AOTQ_DIR"
export PYTHONPATH="${PYTHONPATH:-}:$(pwd)"
set -a
if [[ -f .env ]]; then
  # shellcheck source=/dev/null
  source .env
fi
set +a
if [[ -z "${AOTQ_WORKER_BEARER_TOKEN:-}" ]]; then
  echo "Set AOTQ_WORKER_BEARER_TOKEN in $AOTQ_DIR/.env (must match config.artOfTheQuestion.workerApiSharedSecret)."
  exit 1
fi

echo "Starting AoTQ FastAPI (ingest) on http://${AOTQ_HOST}:${AOTQ_PORT} …"
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -dims "$AOTQ_DIR/.venv/bin/python" -m uvicorn app.main:app --host "$AOTQ_HOST" --port "$AOTQ_PORT" --workers 1 &
else
  "$AOTQ_DIR/.venv/bin/python" -m uvicorn app.main:app --host "$AOTQ_HOST" --port "$AOTQ_PORT" --workers 1 &
fi
UVICORN_PID=$!
sleep 1
if ! kill -0 "${UVICORN_PID}" 2>/dev/null; then
  echo "AoTQ server failed to start. Check port ${AOTQ_PORT} and $AOTQ_DIR/.env"
  exit 1
fi

cd "$BRIDGE_DIR"
set -a
if [[ -f .env ]]; then
  # shellcheck source=/dev/null
  source .env
fi
set +a

echo "Starting bridge (Dropflow yt-dlp + AoTQ relay) …"
if command -v caffeinate >/dev/null 2>&1; then
  exec caffeinate -dims "$BRIDGE_DIR/.venv/bin/python" run_worker.py
else
  exec "$BRIDGE_DIR/.venv/bin/python" run_worker.py
fi
