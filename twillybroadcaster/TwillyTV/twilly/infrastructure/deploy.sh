#!/bin/bash

# Twilly Streaming Infrastructure Deployment Script
# This script automates the entire AWS setup process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="twilly-streaming"
REGION="us-east-1"
INSTANCE_TYPE="t3.medium"
AMI_ID="ami-0c02fb55956c7d316" # Amazon Linux 2
KEY_NAME="${PROJECT_NAME}-key"
SECURITY_GROUP_NAME="${PROJECT_NAME}-sg"
BUCKET_NAME="twilly-clips-$(date +%s)"

echo -e "${BLUE}🚀 Twilly Streaming Infrastructure Deployment${NC}"
echo "=================================================="

# Check AWS CLI installation
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI and credentials verified${NC}"

# Get user input
echo -e "\n${YELLOW}📝 Configuration${NC}"
read -p "Enter your domain name (optional, press Enter to skip): " DOMAIN_NAME
read -p "Enter your email for SSL certificate: " EMAIL

# Check if key pair already exists
echo -e "\n${BLUE}🔑 Checking EC2 key pair...${NC}"
if aws ec2 describe-key-pairs --key-names ${KEY_NAME} --region ${REGION} &>/dev/null; then
    echo -e "${YELLOW}⚠️ Key pair '${KEY_NAME}' already exists. Using existing key.${NC}"
    # Check if SSH key file exists
    if [ ! -f ~/.ssh/${KEY_NAME}.pem ]; then
        echo -e "${RED}❌ SSH key file ~/.ssh/${KEY_NAME}.pem not found. Please download it manually or delete the key pair.${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}🔑 Creating EC2 key pair...${NC}"
    aws ec2 create-key-pair \
        --key-name ${KEY_NAME} \
        --region ${REGION} \
        --query 'KeyMaterial' \
        --output text > ~/.ssh/${KEY_NAME}.pem

    # Set proper permissions for the key file
    chmod 600 ~/.ssh/${KEY_NAME}.pem
    echo -e "${GREEN}✅ Key pair created: ${KEY_NAME}${NC}"
    echo -e "${GREEN}✅ SSH key saved to: ~/.ssh/${KEY_NAME}.pem${NC}"
fi

# Check if security group already exists
echo -e "\n${BLUE}🔥 Checking security group...${NC}"
SG_ID=$(aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=${SECURITY_GROUP_NAME}" \
    --region ${REGION} \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || echo "")

if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
    echo -e "${BLUE}🔥 Creating security group...${NC}"
    SG_ID=$(aws ec2 create-security-group \
        --group-name ${SECURITY_GROUP_NAME} \
        --description "Security group for Twilly streaming" \
        --region ${REGION} \
        --query 'GroupId' --output text)

    # Add security group rules
    aws ec2 authorize-security-group-ingress \
        --group-id ${SG_ID} \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0 \
        --region ${REGION}

    aws ec2 authorize-security-group-ingress \
        --group-id ${SG_ID} \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0 \
        --region ${REGION}

    aws ec2 authorize-security-group-ingress \
        --group-id ${SG_ID} \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0 \
        --region ${REGION}

    aws ec2 authorize-security-group-ingress \
        --group-id ${SG_ID} \
        --protocol tcp \
        --port 1935 \
        --cidr 0.0.0.0/0 \
        --region ${REGION}

    aws ec2 authorize-security-group-ingress \
        --group-id ${SG_ID} \
        --protocol tcp \
        --port 3000 \
        --cidr 0.0.0.0/0 \
        --region ${REGION}

    echo -e "${GREEN}✅ Security group created: ${SG_ID}${NC}"
else
    echo -e "${YELLOW}⚠️ Security group '${SECURITY_GROUP_NAME}' already exists. Using existing group: ${SG_ID}${NC}"
fi

# Check if EC2 instance already exists
echo -e "\n${BLUE}🖥️ Checking EC2 instance...${NC}"
INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=${PROJECT_NAME}" "Name=instance-state-name,Values=running,stopped" \
    --region ${REGION} \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text 2>/dev/null || echo "")

if [ "$INSTANCE_ID" = "None" ] || [ -z "$INSTANCE_ID" ]; then
    echo -e "${BLUE}🖥️ Launching EC2 instance...${NC}"
    INSTANCE_ID=$(aws ec2 run-instances \
        --image-id ${AMI_ID} \
        --count 1 \
        --instance-type ${INSTANCE_TYPE} \
        --key-name ${KEY_NAME} \
        --security-group-ids ${SG_ID} \
        --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]' \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${PROJECT_NAME}}]" \
        --region ${REGION} \
        --query 'Instances[0].InstanceId' --output text)

    echo -e "${GREEN}✅ Instance created: ${INSTANCE_ID}${NC}"

    # Wait for instance to be running
    echo -e "\n${YELLOW}⏳ Waiting for instance to be ready...${NC}"
    aws ec2 wait instance-running --instance-ids ${INSTANCE_ID} --region ${REGION}
else
    echo -e "${YELLOW}⚠️ EC2 instance '${PROJECT_NAME}' already exists. Using existing instance: ${INSTANCE_ID}${NC}"
    
    # Start instance if it's stopped
    INSTANCE_STATE=$(aws ec2 describe-instances \
        --instance-ids ${INSTANCE_ID} \
        --region ${REGION} \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text)
    
    if [ "$INSTANCE_STATE" = "stopped" ]; then
        echo -e "${BLUE}🔄 Starting stopped instance...${NC}"
        aws ec2 start-instances --instance-ids ${INSTANCE_ID} --region ${REGION}
        aws ec2 wait instance-running --instance-ids ${INSTANCE_ID} --region ${REGION}
    fi
fi

# Get the actual key name associated with the instance
KEY_NAME=$(aws ec2 describe-instances \
    --instance-ids ${INSTANCE_ID} \
    --region ${REGION} \
    --query 'Reservations[0].Instances[0].KeyName' \
    --output text)

# Get instance public IP
INSTANCE_IP=$(aws ec2 describe-instances \
    --instance-ids ${INSTANCE_ID} \
    --region ${REGION} \
    --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo -e "${GREEN}✅ Instance IP: ${INSTANCE_IP}${NC}"

# Wait for SSH to be available
echo -e "\n${YELLOW}⏳ Waiting for SSH to be available...${NC}"
until ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP} exit 2>/dev/null; do
    echo "Waiting for SSH..."
    sleep 10
done

# Check if setup script exists in current directory or infrastructure directory
SCRIPT_PATH=""
if [ -f "infrastructure/ec2-setup.sh" ]; then
    SCRIPT_PATH="infrastructure/ec2-setup.sh"
elif [ -f "ec2-setup.sh" ]; then
    SCRIPT_PATH="ec2-setup.sh"
else
    echo -e "${RED}❌ ec2-setup.sh not found. Please run this script from the project root directory.${NC}"
    exit 1
fi

# Copy setup script to instance
echo -e "\n${BLUE}📤 Copying setup script to instance...${NC}"
scp -i ~/.ssh/${KEY_NAME}.pem ${SCRIPT_PATH} ec2-user@${INSTANCE_IP}:~/

# Check if setup has already been run
echo -e "\n${BLUE}🔧 Checking if setup has been run...${NC}"
if ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP} "systemctl is-active nginx" 2>/dev/null; then
    echo -e "${YELLOW}⚠️ NGINX is already running. Skipping setup script.${NC}"
else
    echo -e "\n${BLUE}🔧 Running setup script on instance...${NC}"
    ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP} << 'EOF'
chmod +x ec2-setup.sh
sudo ./ec2-setup.sh
EOF
fi

# Configure environment variables
echo -e "\n${BLUE}⚙️ Configuring environment variables...${NC}"
ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP} << EOF
sudo tee /opt/twilly-streaming/.env > /dev/null << 'ENVEOF'
AWS_REGION=${REGION}
S3_BUCKET=${BUCKET_NAME}
DOMAIN=${DOMAIN_NAME}
ENVEOF

sudo systemctl restart twilly-streaming
EOF

# Setup SSL if domain provided
if [ ! -z "$DOMAIN_NAME" ]; then
    echo -e "\n${BLUE}🔒 Setting up SSL certificate...${NC}"
    ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP} << EOF
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ${DOMAIN_NAME} --email ${EMAIL} --non-interactive --agree-tos
sudo systemctl reload nginx
EOF
fi

# Check if S3 bucket already exists
echo -e "\n${BLUE}📦 Checking S3 bucket...${NC}"
if aws s3 ls s3://${BUCKET_NAME} --region ${REGION} &>/dev/null; then
    echo -e "${YELLOW}⚠️ S3 bucket '${BUCKET_NAME}' already exists. Using existing bucket.${NC}"
else
    echo -e "\n${BLUE}📦 Creating S3 bucket...${NC}"
    aws s3 mb s3://${BUCKET_NAME} --region ${REGION}

    # Configure S3 bucket
    aws s3api put-bucket-cors --bucket ${BUCKET_NAME} --cors-configuration '{
      "CORSRules": [
        {
          "AllowedHeaders": ["*"],
          "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
          "AllowedOrigins": ["*"],
          "ExposeHeaders": ["ETag"]
        }
      ]
    }'
    echo -e "${GREEN}✅ S3 bucket created: ${BUCKET_NAME}${NC}"
fi

# Check if CloudFront distribution already exists
echo -e "\n${BLUE}🌐 Checking CloudFront distribution...${NC}"
CLOUDFRONT_ID=$(aws cloudfront list-distributions \
    --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, '${BUCKET_NAME}')].Id" \
    --output text 2>/dev/null || echo "")

if [ -z "$CLOUDFRONT_ID" ] || [ "$CLOUDFRONT_ID" = "None" ]; then
    echo -e "\n${BLUE}🌐 Creating CloudFront distribution...${NC}"
    DISTRIBUTION_CONFIG=$(cat << EOF
{
  "CallerReference": "$(date +%s)",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-${BUCKET_NAME}",
        "DomainName": "${BUCKET_NAME}.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-${BUCKET_NAME}",
    "ViewerProtocolPolicy": "redirect-to-https",
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF
)

    CLOUDFRONT_ID=$(aws cloudfront create-distribution \
        --distribution-config "${DISTRIBUTION_CONFIG}" \
        --query 'Distribution.Id' --output text)

    echo -e "${GREEN}✅ CloudFront distribution created: ${CLOUDFRONT_ID}${NC}"
else
    echo -e "${YELLOW}⚠️ CloudFront distribution already exists. Using existing distribution: ${CLOUDFRONT_ID}${NC}"
fi

# Create output file
echo -e "\n${BLUE}📄 Creating deployment summary...${NC}"
cat > deployment-summary.txt << EOF
Twilly Streaming Infrastructure Deployment Summary
==================================================

Instance Details:
- Instance ID: ${INSTANCE_ID}
- Public IP: ${INSTANCE_IP}
- Instance Type: ${INSTANCE_TYPE}
- Region: ${REGION}

Security Group:
- ID: ${SG_ID}
- Name: ${SECURITY_GROUP_NAME}

Key Pair:
- Name: ${KEY_NAME}
- SSH Key: ~/.ssh/${KEY_NAME}.pem

S3 Bucket:
- Name: ${BUCKET_NAME}
- Region: ${REGION}

CloudFront:
- Distribution ID: ${CLOUDFRONT_ID}

Streaming URLs:
- RTMP Server: rtmp://${INSTANCE_IP}/live
- HLS Base URL: http://${INSTANCE_IP}/hls
- Status Page: http://${INSTANCE_IP}/status

Larix Broadcaster Settings:
- Server: rtmp://${INSTANCE_IP}/live
- Stream Key: your-stream-key

iPad HLS Player:
- URL: http://${INSTANCE_IP}/hls/your-stream-key/playlist.m3u8

${DOMAIN_NAME:+Domain: ${DOMAIN_NAME}
SSL: Enabled}

Monitoring:
- SSH: ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP}
- Monitor: ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP} '/opt/twilly-streaming/monitor.sh'

Estimated Monthly Cost: ~$46
- EC2: ~$30
- S3: ~$5
- CloudFront: ~$10
- Route 53: ~$1 (if using domain)

Cleanup Commands:
- Delete EC2 instance: aws ec2 terminate-instances --instance-ids ${INSTANCE_ID} --region ${REGION}
- Delete security group: aws ec2 delete-security-group --group-id ${SG_ID} --region ${REGION}
- Delete key pair: aws ec2 delete-key-pair --key-name ${KEY_NAME} --region ${REGION}
- Delete S3 bucket: aws s3 rb s3://${BUCKET_NAME} --force --region ${REGION}
- Delete CloudFront: aws cloudfront delete-distribution --id ${CLOUDFRONT_ID}
EOF

echo -e "\n${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "\n${BLUE}📋 Deployment summary saved to: deployment-summary.txt${NC}"
echo -e "\n${YELLOW}🚀 Next steps:${NC}"
echo "1. Test your stream with Larix Broadcaster"
echo "2. Monitor the system with: ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP} '/opt/twilly-streaming/monitor.sh'"
echo "3. Set up your domain DNS if using custom domain"
echo "4. Configure your Nuxt app to use the streaming URLs"
echo ""
echo -e "${GREEN}🎉 Your streaming infrastructure is ready!${NC}"
echo ""
echo -e "${YELLOW}🔑 SSH Key Information:${NC}"
echo "- Key pair name: ${KEY_NAME}"
echo "- SSH key location: ~/.ssh/${KEY_NAME}.pem"
echo "- SSH command: ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${INSTANCE_IP}" 