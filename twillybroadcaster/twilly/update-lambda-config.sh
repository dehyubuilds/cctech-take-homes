#!/bin/bash
# Update Lambda timeout and memory for processing 15-minute videos

FUNCTION_NAME="s3todynamo"
REGION="us-east-2"
TIMEOUT=900  # 15 minutes (max Lambda timeout)
MEMORY=1024  # 1024MB for better performance with large videos

echo "🔧 Updating Lambda function: $FUNCTION_NAME"
echo "   Region: $REGION"
echo "   Timeout: ${TIMEOUT}s (15 minutes)"
echo "   Memory: ${MEMORY}MB"

aws lambda update-function-configuration \
  --function-name $FUNCTION_NAME \
  --region $REGION \
  --timeout $TIMEOUT \
  --memory-size $MEMORY \
  --query '{FunctionName:FunctionName,Timeout:Timeout,MemorySize:MemorySize}' \
  --output json

echo ""
echo "✅ Lambda configuration updated!"
