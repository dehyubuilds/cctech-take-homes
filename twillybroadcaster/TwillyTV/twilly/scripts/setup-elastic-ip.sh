#!/bin/bash

# Setup Elastic IP for EC2 Streaming Instance
# This ensures the IP address stays the same when you stop/start the instance

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="us-east-1"
INSTANCE_ID="i-0f4de776143f620d1"
CURRENT_IP="100.24.103.57"

echo -e "${BLUE}🌐 Setting up Elastic IP for EC2 Streaming Instance...${NC}"

# Check if Elastic IP already exists for this IP
EXISTING_EIP=$(aws ec2 describe-addresses \
    --region $REGION \
    --filters "Name=public-ip,Values=$CURRENT_IP" \
    --query 'Addresses[0].AllocationId' \
    --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_EIP" ] && [ "$EXISTING_EIP" != "None" ]; then
    echo -e "${YELLOW}⚠️  Elastic IP already exists for $CURRENT_IP${NC}"
    echo -e "${GREEN}✅ Allocation ID: $EXISTING_EIP${NC}"
    
    # Check if it's associated with the instance
    ASSOCIATED_INSTANCE=$(aws ec2 describe-addresses \
        --region $REGION \
        --filters "Name=public-ip,Values=$CURRENT_IP" \
        --query 'Addresses[0].InstanceId' \
        --output text)
    
    if [ "$ASSOCIATED_INSTANCE" = "$INSTANCE_ID" ]; then
        echo -e "${GREEN}✅ Elastic IP is already associated with your instance${NC}"
        echo -e "${GREEN}✅ Your IP address will remain $CURRENT_IP when you stop/start the instance${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Elastic IP exists but is not associated with your instance${NC}"
        echo -e "${BLUE}🔄 Associating Elastic IP with instance...${NC}"
        
        # Disassociate from current instance if any
        if [ "$ASSOCIATED_INSTANCE" != "None" ] && [ -n "$ASSOCIATED_INSTANCE" ]; then
            echo -e "${YELLOW}⚠️  Disassociating from instance $ASSOCIATED_INSTANCE...${NC}"
            aws ec2 disassociate-address \
                --association-id $(aws ec2 describe-addresses \
                    --region $REGION \
                    --filters "Name=public-ip,Values=$CURRENT_IP" \
                    --query 'Addresses[0].AssociationId' \
                    --output text) \
                --region $REGION \
                > /dev/null 2>&1 || true
        fi
        
        # Associate with our instance
        aws ec2 associate-address \
            --instance-id $INSTANCE_ID \
            --allocation-id $EXISTING_EIP \
            --region $REGION \
            > /dev/null
        
        echo -e "${GREEN}✅ Elastic IP associated successfully!${NC}"
    fi
else
    echo -e "${BLUE}🆕 Creating new Elastic IP...${NC}"
    
    # Allocate new Elastic IP
    ALLOCATION_ID=$(aws ec2 allocate-address \
        --domain vpc \
        --region $REGION \
        --query 'AllocationId' \
        --output text)
    
    echo -e "${GREEN}✅ Elastic IP allocated: $ALLOCATION_ID${NC}"
    
    # Get the new IP
    NEW_IP=$(aws ec2 describe-addresses \
        --allocation-ids $ALLOCATION_ID \
        --region $REGION \
        --query 'Addresses[0].PublicIp' \
        --output text)
    
    echo -e "${YELLOW}⚠️  New Elastic IP: $NEW_IP${NC}"
    echo -e "${YELLOW}⚠️  This is different from your current IP ($CURRENT_IP)${NC}"
    echo -e "${YELLOW}⚠️  You'll need to update your RTMP URLs and mobile app configuration${NC}"
    
    # Associate with instance
    echo -e "${BLUE}🔄 Associating Elastic IP with instance...${NC}"
    aws ec2 associate-address \
        --instance-id $INSTANCE_ID \
        --allocation-id $ALLOCATION_ID \
        --region $REGION \
        > /dev/null
    
    echo -e "${GREEN}✅ Elastic IP associated successfully!${NC}"
    echo -e "${GREEN}📡 New IP: $NEW_IP${NC}"
    echo -e "${YELLOW}⚠️  IMPORTANT: Update your mobile app RTMP URL to: rtmp://$NEW_IP:1935/live${NC}"
fi

echo -e "${GREEN}✅ Setup complete!${NC}"
echo -e "${GREEN}💰 Note: Elastic IPs are FREE when associated with a running instance${NC}"
echo -e "${YELLOW}💰 Cost: \$0.005/hour (~\$3.60/month) if instance is stopped${NC}"

