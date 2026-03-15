#!/usr/bin/env bash
# End-to-end deploy: Statics infra + app, then March Madness infra + backend + frontend.
# Prerequisites: AWS CLI configured, Twilio and CBB API keys in .env files.
# Run from Statics repo root: ./scripts/deploy-e2e.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MM_DIR="$ROOT_DIR/march-madness-v1"
cd "$ROOT_DIR"

echo "========== 1. Statics AWS infrastructure =========="
"$SCRIPT_DIR/deploy-statics-infra.sh"

echo ""
echo "========== 2. Load Statics env for app =========="
if [ -f "$ROOT_DIR/.env.local" ]; then
  echo "Using .env.local for Statics app."
else
  echo "Create .env.local with the env block printed above, plus:"
  echo "  TWILIO_ACCOUNT_SID=..."
  echo "  TWILIO_AUTH_TOKEN=..."
  echo "  TWILIO_PHONE_NUMBER=..."
  echo "  NEXT_PUBLIC_APP_URL=https://your-statics-url"
  echo "  STATICS_MARCH_MADNESS_API_KEY=<shared-secret-for-march-madness-allowed-numbers>"
  read -p "Press Enter after .env.local is ready to continue, or Ctrl+C to exit."
fi

echo ""
echo "========== 3. Deploy Statics app (Next.js) =========="
"$SCRIPT_DIR/deploy-statics-app.sh"

STATICS_URL="${NEXT_PUBLIC_APP_URL:-https://your-site.netlify.app}"
echo ""
echo "Set STATICS_BASE_URL and STATICS_API_KEY in March Madness .env:"
echo "  STATICS_BASE_URL=$STATICS_URL"
echo "  STATICS_API_KEY=<same as STATICS_MARCH_MADNESS_API_KEY in Statics .env.local>"

echo ""
echo "========== 4. March Madness infrastructure =========="
if [ -f "$MM_DIR/.env" ]; then
  (cd "$MM_DIR" && "$MM_DIR/scripts/deploy_infra.sh")
else
  echo "Create march-madness-v1/.env from .env.example (CBB, Twilio, Statics URL/API key, AWS, S3). Then run:"
  echo "  cd march-madness-v1 && ./scripts/deploy_infra.sh"
  read -p "Press Enter after March Madness infra is done, or Ctrl+C to exit."
fi

echo ""
echo "========== 5. March Madness backend (Lambda) =========="
(cd "$MM_DIR" && "$MM_DIR/scripts/package_lambda.sh" 2>/dev/null || true)
(cd "$MM_DIR" && "$MM_DIR/scripts/deploy_backend.sh" 2>/dev/null || echo "Run: cd march-madness-v1 && ./scripts/deploy_backend.sh")

echo ""
echo "========== 6. March Madness frontend (S3) =========="
if [ -n "$S3_BUCKET_NAME" ] || grep -q "S3_BUCKET_NAME" "$MM_DIR/.env" 2>/dev/null; then
  (cd "$MM_DIR" && "$MM_DIR/scripts/deploy_frontend.sh" 2>/dev/null) || echo "Set S3_BUCKET_NAME in march-madness-v1/.env and run: cd march-madness-v1 && ./scripts/deploy_frontend.sh"
else
  echo "Set S3_BUCKET_NAME in march-madness-v1/.env then: cd march-madness-v1 && ./scripts/deploy_frontend.sh"
fi

echo ""
echo "========== Done =========="
echo "1. Statics (Netlify): Sign up at $STATICS_URL/signup (first user with admin email is admin)."
echo "2. In Statics Admin, create the March Madness product (or use seed script)."
echo "3. March Madness admin: use the S3 website URL or Lambda API URL from deploy output."
