#!/bin/bash

# Script to investigate 15-minute stream failure
# Run this on the EC2 server or locally with AWS CLI configured

echo "🔍 Investigating 15-minute stream failure..."
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it or run this on the EC2 server.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI found${NC}"
echo ""

# 1. Check most recent videos in DynamoDB
echo "📹 Checking most recent videos in DynamoDB..."
echo "--------------------------------------------"

aws dynamodb query \
  --table-name Twilly \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{
    ":pk": {"S": "USER#dehyu.sinyan@gmail.com"},
    ":sk": {"S": "FILE#"}
  }' \
  --limit 10 \
  --scan-index-forward false \
  --region us-east-1 \
  --output json | jq -r '.Items[] | "\(.SK.S // "N/A") | \(.fileName.S // "N/A") | \(.createdAt.S // .timestamp.S // "N/A") | Visible: \(.isVisible.BOOL // .isVisible // "N/A") | Thumbnail: \(if .thumbnailUrl.S then "YES" else "NO" end)"' 2>/dev/null || \
aws dynamodb query \
  --table-name Twilly \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{
    ":pk": {"S": "USER#dehyu.sinyan@gmail.com"},
    ":sk": {"S": "FILE#"}
  }' \
  --limit 10 \
  --scan-index-forward false \
  --region us-east-1 \
  --output json

echo ""
echo ""

# 2. Check S3 for recent uploads
echo "☁️  Checking S3 for recent uploads..."
echo "-----------------------------------"

RECENT_FILES=$(aws s3 ls s3://theprivatecollection/clips/ --recursive --human-readable --region us-east-1 | tail -20)

if [ -z "$RECENT_FILES" ]; then
    echo -e "${YELLOW}⚠️  No recent files found${NC}"
else
    echo "$RECENT_FILES"
fi

echo ""
echo ""

# 3. Check for incomplete uploads (files without .m3u8 or .ts)
echo "🔍 Checking for incomplete uploads..."
echo "-------------------------------------"

INCOMPLETE=$(aws s3 ls s3://theprivatecollection/clips/ --recursive --region us-east-1 | grep -v "\.m3u8$\|\.ts$\|\.jpg$" | tail -10)

if [ -z "$INCOMPLETE" ]; then
    echo -e "${GREEN}✅ No incomplete uploads found${NC}"
else
    echo -e "${YELLOW}⚠️  Found potentially incomplete uploads:${NC}"
    echo "$INCOMPLETE"
fi

echo ""
echo ""

# 4. Check for videos without thumbnails
echo "🖼️  Checking for videos without thumbnails..."
echo "--------------------------------------------"

# This would require a more complex query - for now, just note it
echo "Check DynamoDB entries above for videos with 'Thumbnail: NO'"

echo ""
echo ""

# 5. Check server logs (if on EC2)
if [ -f "/var/log/streaming-service.log" ]; then
    echo "📋 Checking server logs for errors..."
    echo "-------------------------------------"
    tail -100 /var/log/streaming-service.log | grep -i "error\|fail\|15\|minute\|upload" | tail -20
elif [ -f "streaming-service.log" ]; then
    echo "📋 Checking local logs for errors..."
    echo "-------------------------------------"
    tail -100 streaming-service.log | grep -i "error\|fail\|15\|minute\|upload" | tail -20
else
    echo -e "${YELLOW}⚠️  Log file not found. Check server logs manually.${NC}"
fi

echo ""
echo ""

# 6. Check for processing queue issues
echo "📊 Summary of findings:"
echo "----------------------"
echo "1. Check DynamoDB entries above - look for videos with:"
echo "   - Created around the time you streamed"
echo "   - isVisible: false (might be hidden)"
echo "   - Missing thumbnail (upload might have failed)"
echo ""
echo "2. Check S3 files above - look for:"
echo "   - Files uploaded around stream time"
echo "   - Incomplete uploads (missing .m3u8 or .ts files)"
echo ""
echo "3. Next steps:"
echo "   - If video exists in DynamoDB but not visible: Check isVisible flag"
echo "   - If video exists in S3 but not DynamoDB: Processing might have failed"
echo "   - If no files in S3: Upload never completed"
echo ""
