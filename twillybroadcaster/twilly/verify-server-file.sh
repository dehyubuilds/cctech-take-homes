#!/bin/bash

# Verify which streaming-service-server.js is running on EC2
# Compare it to local file to ensure we're editing the right one

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
LOCAL_FILE="twilly/streaming-service-server.js"

echo -e "${BLUE}🔍 Verifying Server File...${NC}"
echo -e "${BLUE}===========================${NC}\n"

# Check if local file exists
if [ ! -f "$LOCAL_FILE" ]; then
    echo -e "${RED}❌ Local file not found: $LOCAL_FILE${NC}"
    exit 1
fi

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${YELLOW}⚠️  SSH key not found: $SSH_KEY${NC}"
    exit 1
fi

chmod 400 "$SSH_KEY" 2>/dev/null || true

echo -e "${BLUE}1. Finding which file is actually running on server...${NC}"

# Find the actual running process
RUNNING_FILE=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    # Find process
    PID=\$(pgrep -f 'streaming-service-server.js' | head -1)
    if [ -z \"\$PID\" ]; then
        echo \"NOT_RUNNING\"
        exit 0
    fi
    
    # Get the actual file being run
    REAL_PATH=\$(readlink -f /proc/\$PID/exe 2>/dev/null || echo \"\")
    if [ -z \"\$REAL_PATH\" ]; then
        # Try ps to get command
        ps -p \$PID -o args= | awk '{print \$NF}' | head -1
    else
        echo \$REAL_PATH
    fi
" 2>/dev/null)

if [ "$RUNNING_FILE" = "NOT_RUNNING" ]; then
    echo -e "${RED}❌ Service is not running!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Running process found${NC}"

# Find all possible locations
echo -e "\n${BLUE}2. Checking all possible file locations...${NC}"
ALL_FILES=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    find /home /opt -name 'streaming-service-server.js' 2>/dev/null | while read f; do
        echo \"\$f\"
    done
" 2>/dev/null)

echo -e "${GREEN}Found files:${NC}"
echo "$ALL_FILES" | while read f; do
    if [ -n "$f" ]; then
        echo -e "   - $f"
    fi
done

# Check which file the service is using
echo -e "\n${BLUE}3. Checking systemd service configuration...${NC}"
SERVICE_FILE=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    if [ -f /etc/systemd/system/twilly-streaming.service ]; then
        grep ExecStart /etc/systemd/system/twilly-streaming.service | awk '{print \$2}' | head -1
    elif [ -f /etc/systemd/system/streaming-service.service ]; then
        grep ExecStart /etc/systemd/system/streaming-service.service | awk '{print \$2}' | head -1
    else
        echo \"NO_SERVICE_FILE\"
    fi
" 2>/dev/null)

if [ "$SERVICE_FILE" != "NO_SERVICE_FILE" ] && [ -n "$SERVICE_FILE" ]; then
    echo -e "${GREEN}✅ Service file points to: $SERVICE_FILE${NC}"
else
    echo -e "${YELLOW}⚠️  No systemd service file found${NC}"
fi

# Check PM2 if it exists
echo -e "\n${BLUE}4. Checking PM2 processes...${NC}"
PM2_INFO=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    if command -v pm2 >/dev/null 2>&1; then
        pm2 list 2>/dev/null | grep -i streaming || echo \"NO_PM2\"
    else
        echo \"PM2_NOT_INSTALLED\"
    fi
" 2>/dev/null)

if [ -n "$PM2_INFO" ] && [ "$PM2_INFO" != "PM2_NOT_INSTALLED" ] && [ "$PM2_INFO" != "NO_PM2" ]; then
    echo -e "${GREEN}✅ PM2 process found${NC}"
    echo "$PM2_INFO"
else
    echo -e "${YELLOW}⚠️  No PM2 process found${NC}"
fi

# Check for critical privacy code in server file
echo -e "\n${BLUE}5. Checking for privacy fixes in server file...${NC}"

# Get the most likely file location
LIKELY_FILE=$(echo "$ALL_FILES" | head -1)

if [ -z "$LIKELY_FILE" ]; then
    echo -e "${RED}❌ Could not find streaming-service-server.js on server${NC}"
    exit 1
fi

echo -e "${BLUE}Checking file: $LIKELY_FILE${NC}"

# Check for key privacy code
HAS_GLOBAL_MAP=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    if grep -q 'global.streamPrivacyMap' \"$LIKELY_FILE\" 2>/dev/null; then
        echo \"YES\"
    else
        echo \"NO\"
    fi
" 2>/dev/null)

HAS_IMMEDIATE_ENDPOINT=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    if grep -q '/api/streams/set-privacy-immediate' \"$LIKELY_FILE\" 2>/dev/null; then
        echo \"YES\"
    else
        echo \"NO\"
    fi
" 2>/dev/null)

HAS_IS_PRIVATE_PARAM=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    if grep -q 'isPrivateUsernameFromRequest' \"$LIKELY_FILE\" 2>/dev/null; then
        echo \"YES\"
    else
        echo \"NO\"
    fi
" 2>/dev/null)

echo -e "\n${BLUE}Privacy Fix Status:${NC}"
if [ "$HAS_GLOBAL_MAP" = "YES" ]; then
    echo -e "   ${GREEN}✅ global.streamPrivacyMap${NC}"
else
    echo -e "   ${RED}❌ global.streamPrivacyMap${NC}"
fi

if [ "$HAS_IMMEDIATE_ENDPOINT" = "YES" ]; then
    echo -e "   ${GREEN}✅ /api/streams/set-privacy-immediate endpoint${NC}"
else
    echo -e "   ${RED}❌ /api/streams/set-privacy-immediate endpoint${NC}"
fi

if [ "$HAS_IS_PRIVATE_PARAM" = "YES" ]; then
    echo -e "   ${GREEN}✅ isPrivateUsernameFromRequest parameter${NC}"
else
    echo -e "   ${RED}❌ isPrivateUsernameFromRequest parameter${NC}"
fi

# Compare file sizes
echo -e "\n${BLUE}6. Comparing file sizes...${NC}"
LOCAL_SIZE=$(stat -f%z "$LOCAL_FILE" 2>/dev/null || stat -c%s "$LOCAL_FILE" 2>/dev/null)
REMOTE_SIZE=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_IP}" "
    stat -c%s \"$LIKELY_FILE\" 2>/dev/null || stat -f%z \"$LIKELY_FILE\" 2>/dev/null
" 2>/dev/null)

echo -e "   Local file size:  ${LOCAL_SIZE} bytes"
echo -e "   Remote file size: ${REMOTE_SIZE} bytes"

if [ "$LOCAL_SIZE" = "$REMOTE_SIZE" ]; then
    echo -e "   ${GREEN}✅ Sizes match${NC}"
else
    echo -e "   ${RED}❌ Sizes differ - files are different!${NC}"
fi

# Summary
echo -e "\n${BLUE}===========================${NC}"
echo -e "${BLUE}Summary:${NC}"

if [ "$HAS_GLOBAL_MAP" = "YES" ] && [ "$HAS_IMMEDIATE_ENDPOINT" = "YES" ] && [ "$HAS_IS_PRIVATE_PARAM" = "YES" ]; then
    echo -e "${GREEN}✅ Server file appears to have privacy fixes${NC}"
    if [ "$LOCAL_SIZE" != "$REMOTE_SIZE" ]; then
        echo -e "${YELLOW}⚠️  But file sizes differ - may need redeployment${NC}"
    fi
else
    echo -e "${RED}❌ Server file is MISSING privacy fixes!${NC}"
    echo -e "${YELLOW}   Action needed: Deploy updated file${NC}"
    echo -e "\n   Run: ./TwillyTV/twilly/deploy-ec2-server.sh"
fi

echo -e "\n${BLUE}Server file location: $LIKELY_FILE${NC}"
echo -e "${BLUE}Local file location:  $LOCAL_FILE${NC}"
