#!/bin/bash
# Deploy trailer API routes to EC2 and restart Nuxt (twilly.app backend)
# Requires: TWILLY_EC2_IP (default 100.24.103.57), SSH key in ~/.ssh/

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TWILLY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

FILES=(
  "server/api/drops/[dropId]/trailers.post.js"
  "server/api/drops/[dropId]/trailers.get.js"
  "server/api/trailers/[trailerId].get.js"
)

INSTANCE_IP="${TWILLY_EC2_IP:-100.24.103.57}"
SSH_USER="ec2-user"

# Prefer key that matches EC2 KeyName (twilly-streaming-key-1750894315)
for key in "$HOME/.ssh/twilly-streaming-key-1750894315.pem" "$HOME/.ssh/twilly-streaming-key.pem" "$HOME/.ssh/twilly.pem" "$HOME/.ssh/id_rsa"; do
  if [ -f "$key" ]; then
    SSH_KEY="$key"
    break
  fi
done
if [ -z "$SSH_KEY" ]; then
  echo "❌ No SSH key found. Set SSH_KEY or add key to ~/.ssh/"
  exit 1
fi

for rel in "${FILES[@]}"; do
  LOCAL_FILE="$TWILLY_DIR/$rel"
  if [ ! -f "$LOCAL_FILE" ]; then
    echo "❌ Local file not found: $LOCAL_FILE"
    exit 1
  fi
done

echo "🚀 Deploying trailer API to EC2 ($INSTANCE_IP)..."
mkdir -p "$TWILLY_DIR/server/api/drops/[dropId]"
mkdir -p "$TWILLY_DIR/server/api/trailers"

for rel in "${FILES[@]}"; do
  LOCAL_FILE="$TWILLY_DIR/$rel"
  REMOTE_DIR="~/twilly/$(dirname "$rel")"
  REMOTE_PATH="~/twilly/$rel"
  echo "📤 Copying $rel..."
  ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SSH_USER}@${INSTANCE_IP}" "mkdir -p $REMOTE_DIR"
  scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$LOCAL_FILE" "${SSH_USER}@${INSTANCE_IP}:${REMOTE_PATH}" || {
    echo "❌ SCP failed. Check SSH key and EC2 reachability."
    exit 1
  }
done

echo "🔄 Restarting Nuxt..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SSH_USER}@${INSTANCE_IP}" "cd ~/twilly && (npm run build 2>/dev/null || true) && (pm2 restart twilly || pm2 restart all || true)"

echo ""
echo "✅ Trailer API deploy complete. Test at https://twilly.app/api/drops/<fileId>/trailers"
