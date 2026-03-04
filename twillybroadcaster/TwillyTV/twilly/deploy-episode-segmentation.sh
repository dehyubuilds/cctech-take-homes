#!/bin/bash

# Complete End-to-End Deployment: Episode Segmentation System
# Deploys updated code + sets up OpenAI API key + restarts service

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
EC2_IP="100.24.103.57"
EC2_USER="ec2-user"
SSH_KEY="${HOME}/.ssh/twilly-streaming-key-1750894315.pem"
OPENAI_API_KEY="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"
LOCAL_FILE="twilly/streaming-service-server.js"
SERVICE_FILE="/etc/systemd/system/twilly-streaming.service"

echo -e "${BLUE}🚀 Complete Episode Segmentation Deployment${NC}"
echo -e "${BLUE}===========================================${NC}"

# Step 1: Verify files exist
echo -e "\n${BLUE}📋 Step 1: Verifying files...${NC}"
if [ ! -f "$LOCAL_FILE" ]; then
    echo -e "${RED}❌ Local file not found: $LOCAL_FILE${NC}"
    exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}❌ SSH key not found: $SSH_KEY${NC}"
    exit 1
fi

chmod 400 "$SSH_KEY" 2>/dev/null || true
echo -e "${GREEN}✅ Files verified${NC}"

# Step 2: Copy updated code to EC2
echo -e "\n${BLUE}📤 Step 2: Deploying updated code...${NC}"
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "$LOCAL_FILE" "${EC2_USER}@${EC2_IP}:~/streaming-service-server.js" || {
    echo -e "${RED}❌ Failed to copy file${NC}"
    exit 1
}
echo -e "${GREEN}✅ Code copied to EC2${NC}"

# Step 3: Find service location and deploy
echo -e "\n${BLUE}🔍 Step 3: Finding service location...${NC}"
SERVICE_PATH=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    # Check common locations
    for path in /opt/twilly-streaming/streaming-service-server.js /home/ec2-user/streaming-service-server.js; do
        if [ -f \"\$path\" ]; then
            echo \"\$path\"
            exit 0
        fi
    done
    # Try to find it
    find /opt /home -name 'streaming-service-server.js' 2>/dev/null | head -1
" 2>/dev/null)

if [ -z "$SERVICE_PATH" ]; then
    echo -e "${YELLOW}⚠️  Service path not found, using default: /opt/twilly-streaming/streaming-service-server.js${NC}"
    SERVICE_PATH="/opt/twilly-streaming/streaming-service-server.js"
fi

echo -e "${GREEN}✅ Service location: $SERVICE_PATH${NC}"

# Step 4: Copy to service location
echo -e "\n${BLUE}📋 Step 4: Installing code to service location...${NC}"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    sudo cp ~/streaming-service-server.js \"$SERVICE_PATH\" || cp ~/streaming-service-server.js \"$SERVICE_PATH\"
    sudo chown root:root \"$SERVICE_PATH\" 2>/dev/null || true
    sudo chmod 644 \"$SERVICE_PATH\" 2>/dev/null || true
    echo \"✅ Code installed\"
"
echo -e "${GREEN}✅ Code installed${NC}"

# Step 5: Set up OpenAI API key
echo -e "\n${BLUE}🔐 Step 5: Setting up OpenAI API key...${NC}"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    # Check if service file exists
    if [ ! -f \"$SERVICE_FILE\" ]; then
        echo \"⚠️  Service file not found at $SERVICE_FILE\"
        echo \"   Trying to find it...\"
        SERVICE_FILE=\$(find /etc/systemd/system -name '*twilly*.service' 2>/dev/null | head -1)
        if [ -z \"\$SERVICE_FILE\" ]; then
            echo \"❌ Could not find service file\"
            exit 1
        fi
        echo \"✅ Found service file: \$SERVICE_FILE\"
    fi
    
    # Check if Environment line already exists
    if sudo grep -q \"OPENAI_API_KEY\" \"$SERVICE_FILE\"; then
        echo \"⚠️  OPENAI_API_KEY already exists, updating...\"
        sudo sed -i \"s|Environment=\\\"OPENAI_API_KEY=.*\\\"|Environment=\\\"OPENAI_API_KEY=$OPENAI_API_KEY\\\"|\" \"$SERVICE_FILE\"
    else
        echo \"✅ Adding OPENAI_API_KEY to service file...\"
        # Find the [Service] section and add the environment variable
        sudo sed -i '/\[Service\]/a Environment=\"OPENAI_API_KEY='"$OPENAI_API_KEY"'\"' \"$SERVICE_FILE\"
    fi
    
    echo \"✅ OpenAI API key configured\"
"
echo -e "${GREEN}✅ OpenAI API key set up${NC}"

# Step 6: Reload systemd and restart service
echo -e "\n${BLUE}🔄 Step 6: Restarting service...${NC}"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    echo \"🔄 Reloading systemd daemon...\"
    sudo systemctl daemon-reload
    
    echo \"🔄 Restarting twilly-streaming service...\"
    if sudo systemctl restart twilly-streaming; then
        echo \"✅ Service restarted\"
        sleep 2
        if sudo systemctl is-active --quiet twilly-streaming; then
            echo \"✅ Service is running\"
            sudo systemctl status twilly-streaming --no-pager | head -10
        else
            echo \"❌ Service failed to start\"
            sudo systemctl status twilly-streaming --no-pager | tail -20
            exit 1
        fi
    else
        echo \"❌ Failed to restart service\"
        exit 1
    fi
"
echo -e "${GREEN}✅ Service restarted${NC}"

# Step 7: Verify OpenAI key is set
echo -e "\n${BLUE}🔍 Step 7: Verifying OpenAI API key...${NC}"
KEY_SET=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    sudo systemctl show twilly-streaming | grep OPENAI_API_KEY || echo \"NOT_SET\"
" 2>/dev/null)

if [[ "$KEY_SET" == *"OPENAI_API_KEY"* ]]; then
    echo -e "${GREEN}✅ OpenAI API key is set in service${NC}"
else
    echo -e "${YELLOW}⚠️  OpenAI API key not found in service environment${NC}"
fi

# Step 8: Check service logs
echo -e "\n${BLUE}📋 Step 8: Checking recent service logs...${NC}"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    echo \"=== Last 20 lines of service logs ===\"
    sudo journalctl -u twilly-streaming -n 20 --no-pager | tail -20
"

echo -e "\n${GREEN}✅ Deployment Complete!${NC}"
echo -e "${BLUE}===========================================${NC}"
echo -e "\n${BLUE}📋 Next Steps:${NC}"
echo -e "   1. Test with a new stream/video upload"
echo -e "   2. Monitor logs: ssh -i $SSH_KEY ${EC2_USER}@${EC2_IP} 'sudo journalctl -u twilly-streaming -f'"
echo -e "   3. Look for episode segmentation logs: grep 'Episode Segmentation'"
echo -e "\n${YELLOW}⚠️  SECURITY WARNING:${NC}"
echo -e "   Your OpenAI API key was exposed. After testing, regenerate it at:"
echo -e "   https://platform.openai.com/api-keys"
echo -e "   Then update the service file with the new key."
