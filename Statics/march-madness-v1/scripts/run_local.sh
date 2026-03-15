#!/usr/bin/env bash
# Install deps and run local API with the same Python.
set -e
cd "$(dirname "$0")/.."
python3 -m pip install -q -r backend/requirements.txt
echo "March Madness V1 local API: http://localhost:8000"
echo "Frontend: open frontend/index.html?api=http://localhost:8000"
exec python3 backend/server_local.py
