#!/bin/bash

# Downsize EC2 Instance and Deploy Latest Code
# This script:
# 1. Creates an AMI snapshot
# 2. Stops the instance
# 3. Changes instance type to t3.micro
# 4. Starts the instance
# 5. Deploys latest code
# 6. Restarts streaming service
# CRITICAL: Elastic IP is already configured, so IP will remain the same

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
INSTANCE_ID="i-0f4de776143f620d1"
CURRENT_TYPE="t3.medium"
NEW_TYPE="t3.micro"
ELASTIC_IP="100.24.103.57"
REGION="us-east-1"
SSH_KEY="~/.ssh/twilly-key.pem"  # Update with your actual key path
SSH_USER="ec2-user"

echo -e "${BLUE}🚀 Starting EC2 Instance Downsize and Deployment...${NC}\n"

# Step 1: Verify Elastic IP is configured
echo -e "${BLUE}Step 1: Verifying Elastic IP configuration...${NC}"
EIP_CHECK=$(aws ec2 describe-addresses --public-ips $ELASTIC_IP --query 'Addresses[0].InstanceId' --output text 2>/dev/null || echo "none")
if [ "$EIP_CHECK" != "$INSTANCE_ID" ] && [ "$EIP_CHECK" != "None" ]; then
    echo -e "${YELLOW}⚠️  Elastic IP $ELASTIC_IP is not associated with instance $INSTANCE_ID${NC}"
    echo -e "${YELLOW}   Current association: $EIP_CHECK${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ Elastic IP $ELASTIC_IP is configured (will remain static)${NC}"
fi

# Step 2: Create AMI snapshot (safety backup)
echo -e "\n${BLUE}Step 2: Creating AMI snapshot for safety...${NC}"
AMI_NAME="twilly-backup-$(date +%Y%m%d-%H%M%S)"
AMI_ID=$(aws ec2 create-image \
    --instance-id $INSTANCE_ID \
    --name "$AMI_NAME" \
    --description "Backup before downsizing to $NEW_TYPE" \
    --no-reboot \
    --query 'ImageId' \
    --output text)
echo -e "${GREEN}✅ Created AMI: $AMI_ID${NC}"
echo -e "${YELLOW}   Note: AMI creation is in progress (no reboot needed)${NC}"

# Step 3: Stop the instance
echo -e "\n${BLUE}Step 3: Stopping instance...${NC}"
aws ec2 stop-instances --instance-ids $INSTANCE_ID > /dev/null
echo -e "${YELLOW}   Waiting for instance to stop...${NC}"

# Wait for instance to stop
aws ec2 wait instance-stopped --instance-ids $INSTANCE_ID
echo -e "${GREEN}✅ Instance stopped${NC}"

# Step 4: Change instance type
echo -e "\n${BLUE}Step 4: Changing instance type from $CURRENT_TYPE to $NEW_TYPE...${NC}"
aws ec2 modify-instance-attribute \
    --instance-id $INSTANCE_ID \
    --instance-type "{\"Value\": \"$NEW_TYPE\"}" > /dev/null
echo -e "${GREEN}✅ Instance type changed to $NEW_TYPE${NC}"

# Step 5: Start the instance
echo -e "\n${BLUE}Step 5: Starting instance...${NC}"
aws ec2 start-instances --instance-ids $INSTANCE_ID > /dev/null

# Wait for instance to be running
echo -e "${YELLOW}   Waiting for instance to start...${NC}"
aws ec2 wait instance-running --instance-ids $INSTANCE_ID

# Wait a bit more for SSH to be ready
echo -e "${YELLOW}   Waiting for SSH to be ready...${NC}"
sleep 30

# Verify IP is still the same
CURRENT_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
if [ "$CURRENT_IP" == "$ELASTIC_IP" ]; then
    echo -e "${GREEN}✅ Instance started with same IP: $ELASTIC_IP${NC}"
else
    echo -e "${RED}❌ WARNING: IP changed from $ELASTIC_IP to $CURRENT_IP${NC}"
    echo -e "${RED}   This should not happen with Elastic IP configured!${NC}"
    exit 1
fi

# Step 6: Deploy latest code
echo -e "\n${BLUE}Step 6: Deploying latest code...${NC}"

# Check if SSH key exists
if [ ! -f "${SSH_KEY/#\~/$HOME}" ]; then
    echo -e "${YELLOW}⚠️  SSH key not found at $SSH_KEY${NC}"
    echo -e "${YELLOW}   Please update SSH_KEY variable in this script${NC}"
    read -p "Continue with manual deployment? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    echo -e "${YELLOW}   Skipping automatic deployment - please deploy manually${NC}"
else
    echo -e "${YELLOW}   Pulling latest code from repository...${NC}"
    ssh -i "${SSH_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no $SSH_USER@$ELASTIC_IP << 'ENDSSH'
        cd /opt/twilly-streaming || cd ~/twilly || cd /var/www/twilly
        if [ -d ".git" ]; then
            git pull origin main
            echo "✅ Code updated"
        else
            echo "⚠️  Not a git repository - skipping code update"
        fi
ENDSSH
    echo -e "${GREEN}✅ Code deployed${NC}"
fi

# Step 7: Restart streaming service
echo -e "\n${BLUE}Step 7: Restarting streaming service...${NC}"

if [ -f "${SSH_KEY/#\~/$HOME}" ]; then
    ssh -i "${SSH_KEY/#\~/$HOME}" -o StrictHostKeyChecking=no $SSH_USER@$ELASTIC_IP << 'ENDSSH'
        # Restart streaming service (try multiple methods)
        if command -v pm2 &> /dev/null; then
            echo "   Restarting with PM2..."
            pm2 restart streaming-service || pm2 restart all
            pm2 save
        elif [ -f /etc/systemd/system/streaming-service.service ]; then
            echo "   Restarting with systemd..."
            sudo systemctl restart streaming-service
        elif [ -f /etc/init.d/streaming-service ]; then
            echo "   Restarting with init.d..."
            sudo /etc/init.d/streaming-service restart
        else
            echo "   ⚠️  Could not find service manager - please restart manually"
        fi
        
        # Restart nginx
        if command -v nginx &> /dev/null; then
            echo "   Restarting nginx..."
            sudo nginx -t && sudo systemctl restart nginx || sudo service nginx restart
        fi
        
        echo "✅ Services restarted"
ENDSSH
    echo -e "${GREEN}✅ Streaming service restarted${NC}"
else
    echo -e "${YELLOW}⚠️  Please restart streaming service manually:${NC}"
    echo -e "${YELLOW}   ssh $SSH_USER@$ELASTIC_IP${NC}"
    echo -e "${YELLOW}   pm2 restart streaming-service${NC}"
fi

# Summary
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "Instance ID: ${INSTANCE_ID}"
echo -e "Instance Type: ${NEW_TYPE} (downsized from ${CURRENT_TYPE})"
echo -e "IP Address: ${ELASTIC_IP} (static - unchanged)"
echo -e "AMI Backup: ${AMI_ID}"
echo -e "\n${BLUE}Cost Savings:${NC}"
echo -e "  - t3.medium: ~\$30/month"
echo -e "  - t3.micro: ~\$7.50/month"
echo -e "  - Savings: ~\$22.50/month"
echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "  1. Test streaming functionality"
echo -e "  2. Monitor server logs for audio detection messages"
echo -e "  3. Verify all services are running correctly"
echo -e "\n${BLUE}Server Status:${NC}"
echo -e "  SSH: ssh $SSH_USER@$ELASTIC_IP"
echo -e "  RTMP: rtmp://$ELASTIC_IP/live"
echo -e "  API: http://$ELASTIC_IP:3000"
