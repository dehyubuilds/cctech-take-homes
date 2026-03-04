#!/bin/bash

# Deploy websocket-send-unified Lambda Function
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FUNCTION_NAME="websocket-send-unified"
REGION="us-east-1"

echo "🚀 Deploying $FUNCTION_NAME Lambda Function"
echo "Region: $REGION"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI is not installed"
  exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
  echo "❌ AWS credentials not configured"
  exit 1
fi

# Create deployment package
echo "📦 Creating deployment package..."
cd "$SCRIPT_DIR"
zip -j websocket-send-unified.zip websocket-send-unified.js

# Check if function exists
echo "🔍 Checking if function exists..."
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
  echo "✅ Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://websocket-send-unified.zip \
    --region "$REGION"
  
  echo "✅ Function code updated successfully"
else
  echo "⚠️  Function does not exist. Creating new function..."
  echo ""
  echo "📋 You need to create the function manually with proper IAM role."
  echo "   The function needs permissions for:"
  echo "   - DynamoDB (Query, Scan, GetItem, DeleteItem)"
  echo "   - API Gateway Management API (ManageConnections)"
  echo ""
  echo "   Or use the CloudFormation stack deployment:"
  echo "   cd infrastructure && ./deploy-websocket-comments.sh dev us-east-1"
  echo ""
  echo "   Then update the function code:"
  echo "   aws lambda update-function-code \\"
  echo "     --function-name websocket-comments-send \\"
  echo "     --zip-file fileb://websocket-send-unified.zip \\"
  echo "     --region us-east-1"
  echo ""
  echo "   And update code to use 'websocket-comments-send' instead of 'websocket-send-unified'"
fi

echo ""
echo "✅ Deployment script complete!"
