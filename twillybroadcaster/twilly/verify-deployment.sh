#!/bin/bash
# Deployment Verification Script
# Always run this after deploying to verify the code is actually updated

set -e

EC2_HOST="100.24.103.57"
SSH_KEY="$HOME/.ssh/twilly-streaming-key-1750894315.pem"
LOCAL_FILE="twilly/streaming-service-server.js"
REMOTE_TEMP="/home/ec2-user/streaming-service/streaming-service-server.js"
REMOTE_DEPLOYED="/opt/twilly-streaming/streaming-service-server.js"

echo "=== DEPLOYMENT VERIFICATION ==="
echo ""

# 1. Check if files exist
echo "1. Checking file existence..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$EC2_HOST \
  "test -f $REMOTE_TEMP && echo '✅ Temp file exists' || echo '❌ Temp file missing' && \
   test -f $REMOTE_DEPLOYED && echo '✅ Deployed file exists' || echo '❌ Deployed file missing'"

# 2. Check file sizes match
echo ""
echo "2. Checking file sizes..."
LOCAL_SIZE=$(stat -f%z "$LOCAL_FILE" 2>/dev/null || stat -c%s "$LOCAL_FILE" 2>/dev/null)
REMOTE_SIZE=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$EC2_HOST "stat -c%s $REMOTE_DEPLOYED")
if [ "$LOCAL_SIZE" = "$REMOTE_SIZE" ]; then
  echo "✅ Sizes match: $LOCAL_SIZE bytes"
else
  echo "⚠️  Sizes differ: Local=$LOCAL_SIZE, Remote=$REMOTE_SIZE"
fi

# 3. Check syntax
echo ""
echo "3. Checking syntax..."
if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$EC2_HOST "node -c $REMOTE_DEPLOYED" 2>/dev/null; then
  echo "✅ Syntax is valid"
else
  echo "❌ Syntax error detected!"
  exit 1
fi

# 4. Verify critical code sections
echo ""
echo "4. Verifying critical code sections..."

check_code() {
  local description="$1"
  local pattern="$2"
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$EC2_HOST "grep -q '$pattern' $REMOTE_DEPLOYED" 2>/dev/null; then
    echo "✅ $description"
    return 0
  else
    echo "❌ $description - MISSING"
    return 1
  fi
}

ERRORS=0
check_code "RTMP old format check exists" "RTMP stream - checking OLD FORMAT" || ERRORS=$((ERRORS+1))
check_code "isRTMPStream logic exists" "const isRTMPStream = uploadId" || ERRORS=$((ERRORS+1))
check_code "Thumbnail URL uses old format for RTMP" "thumbnailUrl = \`\${cloudFrontBaseUrl}/\${thumbnailKeyOldFormat}\`" || ERRORS=$((ERRORS+1))
check_code "createVideoEntryImmediately called after uploadToS3" "Creating DynamoDB entry immediately AFTER uploadToS3" || ERRORS=$((ERRORS+1))

# 5. Compare key sections
echo ""
echo "5. Comparing key code sections..."
if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$EC2_HOST \
  "diff <(grep -A 3 'RTMP stream - checking OLD FORMAT' $REMOTE_DEPLOYED) <(grep -A 3 'RTMP stream - checking OLD FORMAT' $REMOTE_TEMP)" 2>/dev/null; then
  echo "✅ Temp and deployed files match for RTMP check"
else
  echo "⚠️  Temp and deployed files differ for RTMP check"
fi

# 6. Check service status
echo ""
echo "6. Checking service status..."
SERVICE_STATUS=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ec2-user@$EC2_HOST "sudo systemctl is-active twilly-streaming" 2>/dev/null || echo "inactive")
if [ "$SERVICE_STATUS" = "active" ]; then
  echo "✅ Service is running"
else
  echo "⚠️  Service is $SERVICE_STATUS"
fi

# Summary
echo ""
echo "=== VERIFICATION SUMMARY ==="
if [ $ERRORS -eq 0 ]; then
  echo "✅ All critical checks passed"
  exit 0
else
  echo "❌ $ERRORS critical check(s) failed"
  exit 1
fi
