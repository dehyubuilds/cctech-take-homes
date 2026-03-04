#!/bin/bash

# Update Streaming Configuration with Real EC2 IP
# This script updates the configuration files with your actual EC2 instance IP

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Updating Streaming Configuration...${NC}"

# Get EC2 IP from AWS CLI
EC2_IP=$(aws ec2 describe-instances --instance-ids i-0f4de776143f620d1 --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

if [ -z "$EC2_IP" ]; then
    echo -e "${YELLOW}⚠️  Could not get EC2 IP from AWS CLI${NC}"
    echo -e "${YELLOW}Please manually set EC2_IP in your .env file${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found EC2 IP: $EC2_IP${NC}"

# Update .env file
if [ -f ".env" ]; then
    # Check if EC2_IP already exists in .env
    if grep -q "EC2_IP=" .env; then
        # Update existing EC2_IP
        sed -i.bak "s/EC2_IP=.*/EC2_IP=$EC2_IP/" .env
        echo -e "${GREEN}✅ Updated EC2_IP in .env file${NC}"
    else
        # Add EC2_IP to .env
        echo "" >> .env
        echo "# Streaming Configuration" >> .env
        echo "EC2_IP=$EC2_IP" >> .env
        echo "AWS_REGION=us-east-1" >> .env
        echo -e "${GREEN}✅ Added EC2_IP to .env file${NC}"
    fi
else
    # Create .env file
    cat > .env << EOF
# Twilly Environment Variables

# Streaming Configuration
EC2_IP=$EC2_IP
AWS_REGION=us-east-1

# Add other environment variables here
EOF
    echo -e "${GREEN}✅ Created .env file with EC2_IP${NC}"
fi

# Test the configuration
echo -e "${BLUE}🧪 Testing EC2 connectivity...${NC}"

# Test HTTP connectivity
if curl -s --connect-timeout 5 http://$EC2_IP > /dev/null; then
    echo -e "${GREEN}✅ HTTP connectivity to EC2 successful${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP connectivity to EC2 failed${NC}"
fi

# Test RTMP port
if nc -z -w5 $EC2_IP 1935; then
    echo -e "${GREEN}✅ RTMP port 1935 is open${NC}"
else
    echo -e "${YELLOW}⚠️  RTMP port 1935 is not accessible${NC}"
fi

echo -e "${BLUE}📋 Configuration Summary:${NC}"
echo -e "EC2 Instance ID: i-0f4de776143f620d1"
echo -e "EC2 Public IP: $EC2_IP"
echo -e "Instance Type: t3.medium"
echo -e "Security Group: twilly-streaming-sg"
echo ""
echo -e "${GREEN}🎯 Next Steps:${NC}"
echo -e "1. Run the EC2 setup script: ssh -i your-key.pem ec2-user@$EC2_IP"
echo -e "2. Configure Larix with: rtmp://$EC2_IP/live"
echo -e "3. Test streaming from your iPhone"
echo -e "4. View stream at: http://$EC2_IP/hls/YOUR-STREAM-KEY/playlist.m3u8"
echo ""
echo -e "${GREEN}✅ Configuration updated successfully!${NC}" 