#!/usr/bin/env bash
# Deploy Statics app to github.com/dehyubuilds/statics and March Madness to github.com/dehyubuilds/marchmadness.
# Run from repo root (parent of Statics): ./Statics/scripts/deploy-to-github-repos.sh
# Requires: git, and push access to both GitHub repos.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATICS_SOURCE="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT="$(cd "$STATICS_SOURCE/.." && pwd)"
TMP="${TMPDIR:-/tmp}/statics-deploy-$$"
STATICS_REPO="https://github.com/dehyubuilds/statics.git"
MARCHMADNESS_REPO="https://github.com/dehyubuilds/marchmadness.git"

echo "Source: $STATICS_SOURCE"
echo "---"

# 1) Deploy Statics (Next.js app) -> dehyubuilds/statics
echo "Deploying Statics to $STATICS_REPO ..."
mkdir -p "$TMP"
git clone --depth 1 "$STATICS_REPO" "$TMP/statics" 2>/dev/null || { echo "Clone failed. Create repo at https://github.com/dehyubuilds/statics and try again."; exit 1; }
cd "$TMP/statics"
rsync -a --delete \
  --exclude='march-madness-v1' \
  --exclude='twilly' \
  --exclude='.next' \
  --exclude='node_modules' \
  --exclude='.git' \
  "$STATICS_SOURCE/" .
if [ -f .env.example ] && [ ! -f .env ]; then true; fi
git add -A
if git diff --staged --quiet; then
  echo "Statics: no changes to commit."
else
  git commit -m "Deploy: sync from local Statics"
  git push origin main || git push origin master
  echo "Statics: pushed to origin."
fi
cd "$PARENT"
rm -rf "$TMP/statics"

# 2) Deploy March Madness -> dehyubuilds/marchmadness
echo "Deploying March Madness to $MARCHMADNESS_REPO ..."
git clone --depth 1 "$MARCHMADNESS_REPO" "$TMP/marchmadness" 2>/dev/null || { echo "Clone failed. Create repo at https://github.com/dehyubuilds/marchmadness and try again."; exit 1; }
cd "$TMP/marchmadness"
rsync -a --delete \
  --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='.env' \
  "$STATICS_SOURCE/march-madness-v1/" .
git add -A
if git diff --staged --quiet; then
  echo "March Madness: no changes to commit."
else
  git commit -m "Deploy: sync from local march-madness-v1"
  git push origin main || git push origin master
  echo "March Madness: pushed to origin."
fi
cd "$PARENT"
rm -rf "$TMP/marchmadness"
rmdir "$TMP" 2>/dev/null || true

echo "---"
echo "Done. Statics: $STATICS_REPO | March Madness: $MARCHMADNESS_REPO"
