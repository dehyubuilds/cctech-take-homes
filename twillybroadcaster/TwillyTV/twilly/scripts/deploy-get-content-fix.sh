#!/bin/bash
# Deploy backend API fixes to EC2: get-content (premium tab), timeline-utils (delete cleanup), delete.post, convert-to-post, set-stream-username-type

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TWILLY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Files to deploy (get-content, timeline-utils, delete, user APIs for premium-add, remove-follow, added-usernames, search)
FILES=(
  "server/api/channels/get-content.post.js"
  "server/api/channels/timeline-utils.js"
  "server/api/files/delete.post.js"
  "server/api/streams/convert-to-post.post.js"
  "server/api/streams/set-stream-username-type.post.js"
  "server/api/users/create-premium-subscription.post.js"
  "server/api/users/get-subscription-status.post.js"
  "server/api/users/remove-follow.post.js"
  "server/api/users/added-usernames.post.js"
  "server/api/users/add-premium-creator.post.js"
  "server/api/users/search-usernames.post.js"
)

# EC2 config (match setup-websocket-ec2.sh)
INSTANCE_IP="${TWILLY_EC2_IP:-100.24.103.57}"
SSH_USER="ec2-user"

# SSH key: prefer key matching EC2 KeyName (twilly-streaming-key-1750894315)
for key in "$HOME/.ssh/twilly-streaming-key-1750894315.pem" "$HOME/.ssh/twilly-streaming-key.pem" "$HOME/.ssh/twilly.pem"; do
  if [ -f "$key" ]; then
    SSH_KEY="$key"
    break
  fi
done
if [ -z "$SSH_KEY" ]; then
  echo "❌ No SSH key found. Set SSH_KEY or add twilly-streaming-key.pem to ~/.ssh/"
  exit 1
fi

for rel in "${FILES[@]}"; do
  LOCAL_FILE="$TWILLY_DIR/$rel"
  REMOTE_PATH="~/twilly/$rel"
  if [ ! -f "$LOCAL_FILE" ]; then
    echo "❌ Local file not found: $LOCAL_FILE"
    exit 1
  fi
done

echo "🚀 Deploying backend to EC2 ($INSTANCE_IP)..."
echo "   Files: get-content, timeline-utils, delete, convert-to-post, set-stream-username-type, user APIs (remove-follow, added-usernames), search-usernames"
echo ""

echo "📁 Ensuring remote directories exist..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SSH_USER}@${INSTANCE_IP}" "mkdir -p ~/twilly/server/api/channels ~/twilly/server/api/files ~/twilly/server/api/streams ~/twilly/server/api/users" || true

for rel in "${FILES[@]}"; do
  LOCAL_FILE="$TWILLY_DIR/$rel"
  REMOTE_PATH="~/twilly/$rel"
  echo "📤 Copying $rel..."
  scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$LOCAL_FILE" "${SSH_USER}@${INSTANCE_IP}:${REMOTE_PATH}" || {
    echo "❌ SCP failed. Check SSH key and EC2 reachability."
    exit 1
  }
done

echo "🔄 Restarting Nuxt (pm2 restart twilly)..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SSH_USER}@${INSTANCE_IP}" "pm2 restart twilly || pm2 restart all || true"

echo ""
echo "✅ Deploy complete. Premium add model, delete cleanup, and API fixes are live on EC2."
