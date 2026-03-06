#!/bin/bash
# Deploy API changes to twilly repo (github.com/dehyubuilds/twilly)
set -e
REPO_DIR="${1:-/tmp/twilly-deploy-api}"
# Script is at TwillyTV/twilly/deploy-api-to-twilly.sh; workspace root is ../..
SOURCE_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# Twilly repo has server/ at root; source is TwillyTV/twilly/server/
mkdir -p "$REPO_DIR"
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "Cloning twilly repo..."
  git clone --depth 1 https://github.com/dehyubuilds/twilly.git "$REPO_DIR"
fi
echo "Copying API files..."
mkdir -p "$REPO_DIR/server/api/channels" "$REPO_DIR/server/api/files" "$REPO_DIR/server/api/streams" "$REPO_DIR/server/api/users"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/channels/get-content.post.js" "$REPO_DIR/server/api/channels/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/channels/get-public-channels.post.js" "$REPO_DIR/server/api/channels/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/channels/timeline-utils.js" "$REPO_DIR/server/api/channels/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/channels/timeline-tables.js" "$REPO_DIR/server/api/channels/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/files/delete.post.js" "$REPO_DIR/server/api/files/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/streams/convert-to-post.post.js" "$REPO_DIR/server/api/streams/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/streams/set-stream-username-type.post.js" "$REPO_DIR/server/api/streams/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/users/create-premium-subscription.post.js" "$REPO_DIR/server/api/users/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/users/get-subscription-status.post.js" "$REPO_DIR/server/api/users/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/users/remove-follow.post.js" "$REPO_DIR/server/api/users/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/users/added-usernames.post.js" "$REPO_DIR/server/api/users/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/users/add-premium-creator.post.js" "$REPO_DIR/server/api/users/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/users/search-usernames.post.js" "$REPO_DIR/server/api/users/"
cp "$SOURCE_ROOT/TwillyTV/twilly/server/api/files/update-details.put.js" "$REPO_DIR/server/api/files/"
cd "$REPO_DIR"
git add server/api/channels/get-content.post.js server/api/channels/get-public-channels.post.js server/api/channels/timeline-utils.js server/api/channels/timeline-tables.js server/api/files/delete.post.js server/api/files/update-details.put.js server/api/streams/convert-to-post.post.js server/api/streams/set-stream-username-type.post.js server/api/users/create-premium-subscription.post.js server/api/users/get-subscription-status.post.js server/api/users/remove-follow.post.js server/api/users/added-usernames.post.js server/api/users/add-premium-creator.post.js server/api/users/search-usernames.post.js
if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi
git commit -m "API: premium search filter, premium_access_granted notification, update-details timeline tables, search-usernames"
git push origin main
echo "Pushed to twilly (origin main). Netlify will auto-deploy if connected."
