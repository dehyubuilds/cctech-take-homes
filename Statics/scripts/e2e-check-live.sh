#!/usr/bin/env bash
# Quick E2E check: hit live Statics health and /api/apps.
# Usage: ./scripts/e2e-check-live.sh   or   BASE_URL=https://your-site.netlify.app ./scripts/e2e-check-live.sh
set -e
BASE_URL="${BASE_URL:-https://animated-meerkat-c9b887.netlify.app}"

echo "E2E check: $BASE_URL"
echo "---"

# Health
echo -n "GET /api/health ... "
code=$(curl -s -o /tmp/e2e-health.json -w "%{http_code}" "$BASE_URL/api/health")
if [ "$code" = "200" ]; then
  echo "OK ($code)"
  cat /tmp/e2e-health.json | head -c 200
  echo
else
  echo "FAIL ($code)"
  cat /tmp/e2e-health.json 2>/dev/null || true
  exit 1
fi

echo "---"

# Apps list (public)
echo -n "GET /api/apps ... "
code=$(curl -s -o /tmp/e2e-apps.json -w "%{http_code}" "$BASE_URL/api/apps")
if [ "$code" = "200" ]; then
  echo "OK ($code)"
  cat /tmp/e2e-apps.json | head -c 300
  echo
else
  echo "FAIL ($code)"
  cat /tmp/e2e-apps.json 2>/dev/null || true
  exit 1
fi

echo "---"
echo "Live site and APIs OK. Proceed with manual E2E: docs/E2E-TEST-CHECKLIST.md"
