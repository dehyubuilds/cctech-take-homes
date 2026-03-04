#!/bin/bash

# Deploy Lemon Squeezy API Gateway Infrastructure using AWS CLI
# This script deploys the API Gateway and Lambda function for Lemon Squeezy integration

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_CODE_DIR="$(dirname "$SCRIPT_DIR")/amplify/backend/function/lemonsqueezy-api"
ENVIRONMENT=${1:-dev}
REGION=${2:-us-east-1}
STACK_NAME="lemonsqueezy-api-gateway"

echo "🚀 Deploying Lemon Squeezy API Gateway Infrastructure using AWS CLI"
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

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📋 AWS Account ID: $ACCOUNT_ID"

# Create deployment package for Lambda
echo "📦 Creating Lambda deployment package..."
cd "$LAMBDA_CODE_DIR"
npm install --production
zip -r "$(dirname "$SCRIPT_DIR")/lambda-deployment-package.zip" .
cd "$(dirname "$SCRIPT_DIR")"

# Create S3 bucket for Lambda code
BUCKET_NAME="twilly-lambda-deployments-$ACCOUNT_ID"
echo "📦 Creating S3 bucket: $BUCKET_NAME"
aws s3 mb s3://$BUCKET_NAME --region $REGION 2>/dev/null || echo "Bucket already exists"

# Upload Lambda code to S3
echo "📤 Uploading Lambda code to S3..."
aws s3 cp lambda-deployment-package.zip s3://$BUCKET_NAME/lemonsqueezy-api.zip

# Create IAM Role for Lambda
echo "🔐 Creating IAM Role for Lambda..."
ROLE_NAME="lemonsqueezy-lambda-role-$ENVIRONMENT"

# Create trust policy
cat > /tmp/trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create the role
aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document file:///tmp/trust-policy.json 2>/dev/null || echo "Role already exists"

# Attach basic execution role
aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create DynamoDB access policy
cat > /tmp/dynamodb-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:$REGION:$ACCOUNT_ID:table/Twilly"
    }
  ]
}
EOF

# Attach DynamoDB policy
aws iam put-role-policy --role-name $ROLE_NAME --policy-name DynamoDBAccess --policy-document file:///tmp/dynamodb-policy.json

# Create Secrets Manager access policy
cat > /tmp/secrets-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:$REGION:$ACCOUNT_ID:secret:lemonsqueezy/*"
    }
  ]
}
EOF

# Attach Secrets Manager policy
aws iam put-role-policy --role-name $ROLE_NAME --policy-name SecretsManagerAccess --policy-document file:///tmp/secrets-policy.json

# Get role ARN
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query Role.Arn --output text)

# Create Lambda function
echo "🔧 Creating Lambda function..."
FUNCTION_NAME="lemonsqueezy-api-$ENVIRONMENT"

aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --runtime nodejs18.x \
    --role $ROLE_ARN \
    --handler src/index.handler \
    --code S3Bucket=$BUCKET_NAME,S3Key=lemonsqueezy-api.zip \
    --timeout 30 \
    --memory-size 256 \
    --environment Variables='{DYNAMODB_TABLE=Twilly}' \
    --region $REGION 2>/dev/null || echo "Function already exists"

# Create API Gateway
echo "🌐 Creating API Gateway..."
API_NAME="lemonsqueezy-api-$ENVIRONMENT"
API_ID=$(aws apigateway create-rest-api \
    --name $API_NAME \
    --description "API Gateway for Lemon Squeezy integration" \
    --region $REGION \
    --query id --output text 2>/dev/null || \
    aws apigateway get-rest-apis --query "items[?name=='$API_NAME'].id" --output text)

echo "📋 API Gateway ID: $API_ID"

# Get root resource ID
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
    --rest-api-id $API_ID \
    --query "items[?path=='/'].id" \
    --output text)

# Create /create-product resource
echo "🔗 Creating /create-product resource..."
RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part "create-product" \
    --query id --output text)

# Get Lambda function ARN
FUNCTION_ARN=$(aws lambda get-function --function-name $FUNCTION_NAME --query Configuration.FunctionArn --output text)

# Create POST method first
echo "📝 Creating POST method..."
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method POST \
    --authorization-type NONE

# Create Lambda integration
echo "🔗 Creating Lambda integration..."
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method POST \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$FUNCTION_ARN/invocations"

# Create OPTIONS method for CORS
echo "📝 Creating OPTIONS method for CORS..."
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --authorization-type NONE

# Create mock integration for OPTIONS
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json": "{\"statusCode\": 200}"}'

# Add CORS headers to OPTIONS method response
aws apigateway put-method-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": true, "method.response.header.Access-Control-Allow-Methods": true, "method.response.header.Access-Control-Allow-Origin": true}'

aws apigateway put-integration-response \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers": "'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\''", "method.response.header.Access-Control-Allow-Methods": "'\''GET,POST,OPTIONS'\''", "method.response.header.Access-Control-Allow-Origin": "'\''*'\''"}'

# Add Lambda permission for API Gateway
echo "🔐 Adding Lambda permission..."
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id apigateway-access \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*" 2>/dev/null || echo "Permission already exists"

# Deploy API Gateway
echo "🚀 Deploying API Gateway..."
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name $ENVIRONMENT

# Create Secrets Manager secrets
echo "🔐 Creating Secrets Manager secrets..."
aws secretsmanager create-secret \
    --name "lemonsqueezy/api-key-$ENVIRONMENT" \
    --description "Lemon Squeezy API Key" \
    --secret-string '{"apiKey": "YOUR_API_KEY_HERE"}' 2>/dev/null || echo "API Key secret already exists"

aws secretsmanager create-secret \
    --name "lemonsqueezy/store-id-$ENVIRONMENT" \
    --description "Lemon Squeezy Store ID" \
    --secret-string '{"storeId": "YOUR_STORE_ID_HERE"}' 2>/dev/null || echo "Store ID secret already exists"

aws secretsmanager create-secret \
    --name "lemonsqueezy/webhook-secret-$ENVIRONMENT" \
    --description "Lemon Squeezy Webhook Secret" \
    --secret-string '{"webhookSecret": "YOUR_WEBHOOK_SECRET_HERE"}' 2>/dev/null || echo "Webhook secret already exists"

# Get the API Gateway URL
API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/$ENVIRONMENT/create-product"

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
rm -f /tmp/trust-policy.json
rm -f /tmp/dynamodb-policy.json
rm -f /tmp/secrets-policy.json 