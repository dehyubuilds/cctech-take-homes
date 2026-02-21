#!/bin/bash

# Alternative Deployment Method using AWS CLI
# This uses AWS Systems Manager (SSM) to run commands if SSH fails

set -e

INSTANCE_ID="i-0f4de776143f620d1"
REGION="us-east-1"

echo "🚀 Attempting deployment via AWS Systems Manager..."

# Check if SSM is available
SSM_STATUS=$(aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
    --query 'InstanceInformationList[0].PingStatus' \
    --output text 2>/dev/null || echo "unavailable")

if [ "$SSM_STATUS" == "Online" ]; then
    echo "✅ SSM is available, deploying via SSM..."
    
    # Download and deploy code
    aws ssm send-command \
        --instance-ids "$INSTANCE_ID" \
        --document-name "AWS-RunShellScript" \
        --parameters 'commands=[
            "cd /opt/twilly-streaming 2>/dev/null || cd ~/twilly 2>/dev/null || cd /var/www/twilly 2>/dev/null || cd ~",
            "curl -f -o streaming-service-server.js https://raw.githubusercontent.com/dehyubuilds/cctech-take-homes/main/twilly/streaming-service-server.js",
            "pm2 restart streaming-service 2>/dev/null || sudo systemctl restart streaming-service 2>/dev/null",
            "sudo systemctl restart nginx 2>/dev/null"
        ]' \
        --output text \
        --query 'Command.CommandId'
    
    echo "✅ Command sent via SSM"
    echo "   Check AWS Console > Systems Manager > Run Command for status"
else
    echo "❌ SSM not available (Status: $SSM_STATUS)"
    echo ""
    echo "Please deploy manually:"
    echo "1. SSH into server: ssh -i ~/.ssh/twilly-streaming-key.pem ec2-user@100.24.103.57"
    echo "2. Run deployment commands from DEPLOYMENT_INSTRUCTIONS.md"
fi
