#!/usr/bin/env bash
# Build and deploy Statics Next.js app to Netlify.
# Uses Netlify CLI if available; else prints manual steps.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo "Building Statics..."
npm run build
echo "Build OK."

if command -v netlify &>/dev/null; then
  echo "Deploying to Netlify..."
  netlify deploy --prod --dir=.next 2>/dev/null || netlify deploy --prod
  echo "Set env vars in Netlify: Site settings → Environment variables (NEXT_PUBLIC_COGNITO_*, AWS_REGION, STATICS_*_TABLE, TWILIO_*, etc.)"
else
  echo "Netlify CLI not found. To deploy:"
  echo "  1. npm i -g netlify-cli && netlify login"
  echo "  2. netlify init   # or link to existing site"
  echo "  3. Add env vars in Netlify Dashboard → Site settings → Environment variables"
  echo "  4. netlify deploy --prod"
  echo ""
  echo "Or connect your repo in Netlify Dashboard; Netlify will build and deploy on push."
fi
