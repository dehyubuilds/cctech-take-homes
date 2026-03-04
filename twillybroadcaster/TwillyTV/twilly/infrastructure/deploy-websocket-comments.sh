#!/bin/bash

# Deploy WebSocket API for real-time comment notifications
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_DIR="$(dirname "$SCRIPT_DIR")/lambda"
ENVIRONMENT=${1:-dev}
REGION=${2:-us-east-1}
STACK_NAME="websocket-comments-api-${ENVIRONMENT}"

echo "🚀 Deploying WebSocket Comments API"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Stack Name: $STACK_NAME"

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

# Deploy CloudFormation stack
echo "🏗️  Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file "$SCRIPT_DIR/websocket-comments-api.yml" \
  --stack-name "$STACK_NAME" \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    DynamoDBTableName="Twilly" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --region "$REGION"

# Get WebSocket API endpoint
echo "🔗 Getting WebSocket API endpoint..."
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketApiEndpoint`].OutputValue' \
  --output text)

HTTP_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketApiEndpointHttp`].OutputValue' \
  --output text)

echo ""
echo "✅ WebSocket API deployed successfully!"
echo "📡 WebSocket Endpoint: $API_ENDPOINT"
echo "🌐 HTTP Endpoint: $HTTP_ENDPOINT"
echo ""
echo "📦 Now deploying Lambda functions..."

# Get Lambda role ARN
LAMBDA_ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`WebSocketLambdaRoleArn`].OutputValue' \
  --output text)

# Package and deploy Lambda functions
for func in websocket-comments-connect websocket-comments-disconnect websocket-comments-send; do
  echo "📦 Packaging $func..."
  cd "$LAMBDA_DIR"
  
  # Create deployment package
  if [ -f "${func}.js" ]; then
    zip -j "/tmp/${func}.zip" "${func}.js"
  else
    echo "⚠️  ${func}.js not found, creating placeholder..."
    echo "exports.handler = async (event) => { return { statusCode: 200 }; };" > "/tmp/${func}.js"
    zip -j "/tmp/${func}.zip" "/tmp/${func}.js"
  fi
  
  # Determine function name
  FUNCTION_NAME="${func}"
  if [ "$func" != "websocket-comments-send" ]; then
    FUNCTION_NAME="${ENVIRONMENT}-${func}"
  fi
  
  echo "📤 Deploying $FUNCTION_NAME..."
  
  # Check if function exists
  if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &>/dev/null; then
    # Update existing function
    echo "   Updating existing function..."
    aws lambda update-function-code \
      --function-name "$FUNCTION_NAME" \
      --zip-file "fileb:///tmp/${func}.zip" \
      --region "$REGION"
    
    # Update environment variables
    if [ "$func" = "websocket-comments-send" ]; then
      aws lambda update-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --environment "Variables={TABLE_NAME=Twilly,WEBSOCKET_API_ENDPOINT=${HTTP_ENDPOINT}}" \
        --region "$REGION"
    else
      aws lambda update-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --environment "Variables={TABLE_NAME=Twilly}" \
        --region "$REGION"
    fi
  else
    # Create new function
    echo "   Creating new function..."
    ENV_VARS="Variables={TABLE_NAME=Twilly}"
    if [ "$func" = "websocket-comments-send" ]; then
      ENV_VARS="Variables={TABLE_NAME=Twilly,WEBSOCKET_API_ENDPOINT=${HTTP_ENDPOINT}}"
    fi
    
    aws lambda create-function \
      --function-name "$FUNCTION_NAME" \
      --runtime nodejs18.x \
      --role "$LAMBDA_ROLE_ARN" \
      --handler index.handler \
      --zip-file "fileb:///tmp/${func}.zip" \
      --environment "$ENV_VARS" \
      --timeout 30 \
      --region "$REGION"
  fi
done

echo ""
echo "✅ Deployment complete!"
echo "📡 WebSocket Endpoint: $API_ENDPOINT"
echo ""
echo "💡 To connect from mobile app, use:"
echo "   wss://${API_ENDPOINT#wss://}?userEmail=USER_EMAIL"
