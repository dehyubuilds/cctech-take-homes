#!/usr/bin/env bash
# Local / EC2: AoTQ FastAPI ingest (POST /ingest). Loads .env from this directory.
# Prefer this over a bare `uvicorn` on PATH — uses .venv when present.
# On macOS, wraps the server in `caffeinate -dims` so long transcriptions do not let the machine sleep.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
export PYTHONPATH="${PYTHONPATH:-}:$(pwd)"

if [[ -f .env ]]; then
  set -a
  # shellcheck source=/dev/null
  source .env
  set +a
fi

if [[ -x "$ROOT/.venv/bin/python" ]]; then
  PY="$ROOT/.venv/bin/python"
else
  PY="$(command -v python3)"
fi

HOST="${AOTQ_WORKER_HOST:-0.0.0.0}"
PORT="${AOTQ_WORKER_PORT:-8787}"
# macOS: keep display / disk / idle awake while the worker runs (no-op if caffeinate missing, e.g. Linux).
if command -v caffeinate >/dev/null 2>&1; then
  exec caffeinate -dims "$PY" -m uvicorn app.main:app --host "$HOST" --port "$PORT" --workers 1
else
  exec "$PY" -m uvicorn app.main:app --host "$HOST" --port "$PORT" --workers 1
fi
