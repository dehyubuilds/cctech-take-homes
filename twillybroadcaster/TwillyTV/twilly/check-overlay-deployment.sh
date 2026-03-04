#!/bin/bash

# Script to check overlay deployment status

EC2_IP="54.160.229.57"
EC2_USER="ec2-user"

echo "🔍 Checking Overlay Deployment Status..."
echo ""

# Try to find SSH key
SSH_KEY=""
if [ -f ~/.ssh/twilly-streaming-key*.pem ]; then
    SSH_KEY=$(ls ~/.ssh/twilly-streaming-key*.pem | head -1)
elif [ -f ~/.ssh/twilly*.pem ]; then
    SSH_KEY=$(ls ~/.ssh/twilly*.pem | head -1)
elif [ -f ~/.ssh/streaming*.pem ]; then
    SSH_KEY=$(ls ~/.ssh/streaming*.pem | head -1)
else
    # List available keys
    echo "Available SSH keys:"
    ls ~/.ssh/*.pem 2>/dev/null | head -5
    echo ""
    echo "Please set SSH_KEY environment variable:"
    echo "export SSH_KEY=~/.ssh/your-key.pem"
    exit 1
fi

echo "Using SSH key: $SSH_KEY"
echo ""

# Check if code is deployed
echo "1️⃣ Checking if overlay functions exist in streaming-service-server.js..."
ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=no $EC2_USER@$EC2_IP \
  "grep -n 'getOverlayMetadata\|downloadOverlayImage' /opt/twilly-streaming/streaming-service-server.js 2>/dev/null || \
   grep -n 'getOverlayMetadata\|downloadOverlayImage' /home/ec2-user/streaming-service/streaming-service-server.js 2>/dev/null || \
   find /opt /home/ec2-user -name 'streaming-service-server.js' -type f 2>/dev/null | head -1 | xargs grep -n 'getOverlayMetadata' 2>/dev/null || \
   echo '❌ Overlay functions NOT FOUND - Code not deployed'"

echo ""
echo "2️⃣ Checking recent logs for overlay processing..."
ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=no $EC2_USER@$EC2_IP \
  "sudo journalctl -u twilly-streaming -n 200 --no-pager 2>/dev/null | grep -i 'overlay\|watermark\|metadata' | tail -20 || \
   sudo journalctl -u streaming-service -n 200 --no-pager 2>/dev/null | grep -i 'overlay\|watermark\|metadata' | tail -20 || \
   echo '❌ Cannot find logs - check service name'"

echo ""
echo "3️⃣ Checking if overlay image files exist..."
ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=no $EC2_USER@$EC2_IP \
  "ls -lah /tmp/overlay-* /tmp/twilly-watermark.png 2>/dev/null | tail -5 || echo 'No overlay image files found'"

echo ""
echo "4️⃣ Checking service status..."
ssh -i "$SSH_KEY" -o ConnectTimeout=5 -o StrictHostKeyChecking=no $EC2_USER@$EC2_IP \
  "sudo systemctl status twilly-streaming --no-pager -l 2>/dev/null | head -15 || \
   sudo systemctl status streaming-service --no-pager -l 2>/dev/null | head -15 || \
   echo 'Service status check failed'"

echo ""
echo "✅ Check complete!"


