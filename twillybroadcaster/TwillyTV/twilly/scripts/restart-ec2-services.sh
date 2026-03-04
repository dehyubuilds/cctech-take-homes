#!/bin/bash
# Restart only the streaming/nginx services on EC2 via SSH (no server reboot, IP unchanged).

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTANCE_IP="${TWILLY_EC2_IP:-100.24.103.57}"
SSH_USER="ec2-user"
RESTART_NGINX="${RESTART_NGINX:-1}"

# Same SSH key logic as deploy-trailer-api.sh / deploy-ec2-server.sh
for key in "$HOME/.ssh/twilly-streaming-key-1750894315.pem" "$HOME/.ssh/twilly-streaming-key.pem" "$HOME/.ssh/twilly.pem" "$HOME/.ssh/id_rsa"; do
  if [ -f "$key" ]; then
    SSH_KEY="$key"
    break
  fi
done
if [ -z "$SSH_KEY" ]; then
  echo -e "${RED}❌ No SSH key found. Add one of: twilly-streaming-key-1750894315.pem, twilly-streaming-key.pem, twilly.pem, id_rsa${NC}"
  exit 1
fi

chmod 400 "$SSH_KEY" 2>/dev/null || true

echo -e "${BLUE}🔄 Restarting EC2 services (no server reboot, IP unchanged)...${NC}\n"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${SSH_USER}@${INSTANCE_IP}" "
set -e
echo '--- Streaming service ---'
if sudo systemctl list-units --type=service --all 2>/dev/null | grep -q twilly-streaming; then
  sudo systemctl restart twilly-streaming && echo '✅ twilly-streaming restarted (systemctl)' || true
elif command -v pm2 >/dev/null 2>&1 && pm2 list 2>/dev/null | grep -q -E 'streaming-service|streaming-service-server'; then
  pm2 restart streaming-service-server 2>/dev/null || pm2 restart streaming-service 2>/dev/null || pm2 restart all
  echo '✅ Streaming service restarted (pm2)'
  pm2 status 2>/dev/null | head -10
else
  echo '⚠️  Restarting streaming process manually...'
  pkill -f 'streaming-service-server.js' || true
  sleep 2
  for path in /opt/twilly-streaming/streaming-service-server.js /home/ec2-user/streaming-service-server.js; do
    if [ -f \"\$path\" ]; then
      cd \$(dirname \"\$path\")
      nohup node streaming-service-server.js >> server.log 2>&1 &
      echo '✅ Streaming service restarted (nohup)'
      break
    fi
  done
fi

if [ \"$RESTART_NGINX\" = '1' ]; then
  echo ''
  echo '--- NGINX (RTMP/HLS) ---'
  if sudo systemctl restart nginx 2>/dev/null; then
    echo '✅ nginx restarted (systemctl)'
  elif [ -x /usr/local/nginx/sbin/nginx ]; then
    sudo /usr/local/nginx/sbin/nginx -s reload 2>/dev/null && echo '✅ nginx reloaded' || true
  else
    echo '⚠️  nginx not found or not managed by systemctl'
  fi
fi

echo ''
echo 'Done.'
"

echo -e "\n${GREEN}✅ Service restart complete. IP unchanged: $INSTANCE_IP${NC}\n"
