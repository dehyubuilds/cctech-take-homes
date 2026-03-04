#!/bin/bash
# Restart EC2 streaming instance and ensure IP persists (Elastic IP).
# Uses reboot so the same instance keeps its Elastic IP; no IP change.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REGION="${AWS_REGION:-us-east-1}"
INSTANCE_ID="i-0f4de776143f620d1"
EXPECTED_IP="100.24.103.57"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}🔄 EC2 restart with persistent IP${NC}\n"

# 1) Ensure Elastic IP is associated so IP persists across reboot/stop-start
echo -e "${BLUE}Step 1: Ensuring Elastic IP is associated...${NC}"
EIP_INSTANCE=$(aws ec2 describe-addresses \
    --region "$REGION" \
    --filters "Name=public-ip,Values=$EXPECTED_IP" \
    --query 'Addresses[0].InstanceId' \
    --output text 2>/dev/null || echo "None")

if [ -z "$EIP_INSTANCE" ] || [ "$EIP_INSTANCE" = "None" ]; then
    echo -e "${YELLOW}⚠️  Elastic IP $EXPECTED_IP not associated (or not found). Running setup-elastic-ip.sh...${NC}"
    if [ -f "$SCRIPT_DIR/setup-elastic-ip.sh" ]; then
        bash "$SCRIPT_DIR/setup-elastic-ip.sh"
    else
        echo -e "${RED}❌ setup-elastic-ip.sh not found. Run it first so the IP persists:${NC}"
        echo "   cd $(dirname "$SCRIPT_DIR") && ./scripts/setup-elastic-ip.sh"
        exit 1
    fi
elif [ "$EIP_INSTANCE" != "$INSTANCE_ID" ]; then
    echo -e "${YELLOW}⚠️  Elastic IP is associated with a different instance. Run setup-elastic-ip.sh to fix.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Elastic IP $EXPECTED_IP is associated with this instance (IP will persist).${NC}"
fi

# 2) Reboot instance (same instance + same EIP = same IP after restart)
echo -e "\n${BLUE}Step 2: Rebooting instance $INSTANCE_ID...${NC}"
aws ec2 reboot-instances --instance-ids "$INSTANCE_ID" --region "$REGION"
echo -e "${GREEN}✅ Reboot requested.${NC}"

echo -e "\n${GREEN}✅ Done. Instance is rebooting; IP will remain ${EXPECTED_IP}.${NC}"
echo -e "${YELLOW}   Allow 1–2 minutes for the instance to come back. SSH: ec2-user@$EXPECTED_IP${NC}\n"
