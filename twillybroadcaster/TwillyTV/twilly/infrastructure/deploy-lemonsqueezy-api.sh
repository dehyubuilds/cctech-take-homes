#!/bin/bash

# Deploy Lemon Squeezy API Gateway Infrastructure
# This script deploys the API Gateway and Lambda function for Lemon Squeezy integration

set -e

# Configuration
STACK_NAME="lemonsqueezy-api-gateway"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/lemonsqueezy-api-gateway.yml"
LAMBDA_CODE_DIR="$(dirname "$SCRIPT_DIR")/amplify/backend/function/lemonsqueezy-api"
ENVIRONMENT=${1:-dev}
REGION=${2:-us-east-1}

echo "🚀 Deploying Lemon Squeezy API Gateway Infrastructure"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "Stack Name: $STACK_NAME"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS credentials are not configured. Please run 'aws configure' first."
    exit 1
fi

# Create deployment package for Lambda
echo "📦 Creating Lambda deployment package..."
cd "$LAMBDA_CODE_DIR"
npm install --production
zip -r "$(dirname "$SCRIPT_DIR")/lambda-deployment-package.zip" .
cd "$(dirname "$SCRIPT_DIR")"

# Upload Lambda code to S3
echo "📤 Uploading Lambda code to S3..."
BUCKET_NAME="twilly-lambda-deployments-$(aws sts get-caller-identity --query Account --output text)"
aws s3 mb s3://$BUCKET_NAME --region $REGION 2>/dev/null || true
aws s3 cp lambda-deployment-package.zip s3://$BUCKET_NAME/lemonsqueezy-api.zip

# Deploy CloudFormation stack
echo "🏗️  Deploying CloudFormation stack..."
aws cloudformation deploy \
    --template-file "$TEMPLATE_FILE" \
    --stack-name "$STACK_NAME" \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        DynamoDBTableName="Twilly" \
    --capabilities CAPABILITY_IAM \
    --region "$REGION"

# Get the API Gateway URL
echo "🔗 Getting API Gateway URL..."
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`CreateProductEndpoint`].OutputValue' \
    --output text)

echo "✅ Deployment complete!"
echo "📋 API Gateway URL: $API_URL"
echo ""
echo "🔧 Next steps:"
echo "1. Update your Lemon Squeezy credentials in AWS Secrets Manager:"
echo "   - lemonsqueezy/api-key-$ENVIRONMENT"
echo "   - lemonsqueezy/store-id-$ENVIRONMENT"
echo "   - lemonsqueezy/webhook-secret-$ENVIRONMENT"
echo ""
echo "2. Update your frontend to use the new API Gateway URL:"
echo "   $API_URL"
echo ""
echo "3. Test the integration with a sample request:"
echo "   curl -X POST $API_URL \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"creatorId\":\"test\",\"clipId\":\"test\",\"title\":\"Test Product\",\"price\":2.99}'"

# Clean up
rm -f "$(dirname "$SCRIPT_DIR")/lambda-deployment-package.zip" 