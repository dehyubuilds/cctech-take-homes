#!/bin/bash

# Deploy Updated EC2 Streaming Server
# This script copies the updated streaming-service-server.js to EC2 and restarts the service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EC2_IP="100.24.103.57"
EC2_USER="ec2-user"
SSH_KEY="${HOME}/.ssh/twilly-streaming-key-1750894315.pem"
# Use absolute path or relative path from project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# Use the file in TwillyTV/twilly directory (the one we're actually editing)
LOCAL_FILE="$SCRIPT_DIR/streaming-service-server.js"
REMOTE_PATHS=(
    "/opt/twilly-streaming/streaming-service-server.js"
    "/home/ec2-user/streaming-service-server.js"
    "/home/ec2-user/streaming-service/streaming-service-server.js"
)

echo -e "${BLUE}🚀 Deploying Updated EC2 Streaming Server...${NC}"

# Check if local file exists
if [ ! -f "$LOCAL_FILE" ]; then
    echo -e "${RED}❌ Local file not found: $LOCAL_FILE${NC}"
    exit 1
fi

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${YELLOW}⚠️  SSH key not found: $SSH_KEY${NC}"
    echo -e "${YELLOW}Please update SSH_KEY variable in this script${NC}"
    exit 1
fi

# Set correct permissions on SSH key
chmod 400 "$SSH_KEY" 2>/dev/null || true

echo -e "${BLUE}📤 Copying file to EC2...${NC}"
# Try to copy to home directory first
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$LOCAL_FILE" "${EC2_USER}@${EC2_IP}:~/streaming-service-server.js" || {
    echo -e "${RED}❌ Failed to copy file. Please check:${NC}"
    echo -e "   1. SSH key is correct: $SSH_KEY"
    echo -e "   2. EC2 instance is running: $EC2_IP"
    echo -e "   3. Security group allows SSH (port 22)"
    exit 1
}

echo -e "${GREEN}✅ File copied successfully${NC}"

echo -e "${BLUE}🔍 Finding service location...${NC}"
# Find where the service is running
SERVICE_PATH=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    for path in ${REMOTE_PATHS[@]}; do
        if [ -f \"\$path\" ]; then
            echo \"\$path\"
            exit 0
        fi
    done
    
    # Try to find it
    find /home /opt -name 'streaming-service-server.js' 2>/dev/null | head -1
" 2>/dev/null)

if [ -z "$SERVICE_PATH" ]; then
    echo -e "${YELLOW}⚠️  Could not find service location automatically${NC}"
    echo -e "${YELLOW}Please manually:${NC}"
    echo -e "   1. SSH into EC2: ssh -i $SSH_KEY ${EC2_USER}@${EC2_IP}"
    echo -e "   2. Find streaming-service-server.js location"
    echo -e "   3. Copy ~/streaming-service-server.js to that location"
    echo -e "   4. Restart the service"
    exit 1
fi

echo -e "${GREEN}✅ Found service at: $SERVICE_PATH${NC}"

echo -e "${BLUE}📋 Copying file to service location...${NC}"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    sudo cp ~/streaming-service-server.js \"$SERVICE_PATH\" || cp ~/streaming-service-server.js \"$SERVICE_PATH\"
    echo \"✅ File copied to service location\"
"

echo -e "${BLUE}🔄 Restarting service...${NC}"
# Try different restart methods
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    # Try systemctl first
    if sudo systemctl restart twilly-streaming 2>/dev/null; then
        echo \"✅ Service restarted via systemctl\"
        sudo systemctl status twilly-streaming --no-pager | head -5
    # Try pm2
    elif pm2 restart streaming-service-server 2>/dev/null; then
        echo \"✅ Service restarted via pm2\"
        pm2 status
    # Try killing and restarting manually
    else
        echo \"⚠️  Trying manual restart...\"
        pkill -f 'streaming-service-server.js' || true
        sleep 2
        cd \$(dirname \"$SERVICE_PATH\")
        nohup node streaming-service-server.js > server.log 2>&1 &
        echo \"✅ Service restarted manually\"
    fi
"

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "   1. Test with a new video upload"
echo -e "   2. Check EC2 logs for metadata storage messages"
echo -e "   3. Check Lambda logs for metadata retrieval"

