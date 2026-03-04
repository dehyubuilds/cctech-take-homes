#!/bin/bash

# Update Lemon Squeezy Secrets in AWS Secrets Manager
# This script helps you update the Lemon Squeezy credentials

set -e

ENVIRONMENT=${1:-dev}
REGION=${2:-us-east-1}

echo "🔐 Updating Lemon Squeezy Secrets in AWS Secrets Manager"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"

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

echo ""
echo "Please provide your Lemon Squeezy credentials:"
echo ""

# Get API Key
read -p "Enter your Lemon Squeezy API Key: " API_KEY
if [ -z "$API_KEY" ]; then
    echo "❌ API Key is required"
    exit 1
fi

# Get Store ID
read -p "Enter your Lemon Squeezy Store ID: " STORE_ID
if [ -z "$STORE_ID" ]; then
    echo "❌ Store ID is required"
    exit 1
fi

# Get Webhook Secret
read -p "Enter your Lemon Squeezy Webhook Secret: " WEBHOOK_SECRET
if [ -z "$WEBHOOK_SECRET" ]; then
    echo "❌ Webhook Secret is required"
    exit 1
fi

echo ""
echo "Updating secrets..."

# Update API Key
echo "📝 Updating API Key..."
aws secretsmanager update-secret \
    --secret-id "lemonsqueezy/api-key-$ENVIRONMENT" \
    --secret-string "{\"apiKey\": \"$API_KEY\"}" \
    --region $REGION

# Update Store ID
echo "📝 Updating Store ID..."
aws secretsmanager update-secret \
    --secret-id "lemonsqueezy/store-id-$ENVIRONMENT" \
    --secret-string "{\"storeId\": \"$STORE_ID\"}" \
    --region $REGION

# Update Webhook Secret
echo "📝 Updating Webhook Secret..."
aws secretsmanager update-secret \
    --secret-id "lemonsqueezy/webhook-secret-$ENVIRONMENT" \
    --secret-string "{\"webhookSecret\": \"$WEBHOOK_SECRET\"}" \
    --region $REGION

echo ""
echo "✅ Secrets updated successfully!"
echo ""
echo "🔧 Next steps:"
echo "1. Test the API Gateway endpoint:"
echo "   curl -X POST https://b5m26q7yak.execute-api.us-east-1.amazonaws.com/dev/create-product \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"creatorId\":\"test\",\"clipId\":\"test\",\"title\":\"Test Product\",\"price\":2.99}'"
echo ""
echo "2. Try creating a product in your application"
echo "" 