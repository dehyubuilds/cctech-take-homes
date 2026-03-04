#!/bin/bash

# Deploy WebSocket Brain Lambda Function
# This script deploys the centralized WebSocket brain for all WebSocket interactions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FUNCTION_NAME="twilly-websocket-brain"
REGION="us-east-1"
RUNTIME="nodejs18.x"
HANDLER="websocket-brain.handler"
TIMEOUT=30
MEMORY_SIZE=512
ROLE_NAME="twilly-websocket-brain-role"
POLICY_NAME="twilly-websocket-brain-policy"

echo -e "${BLUE}🧠 Deploying Twilly WebSocket Brain Lambda Function${NC}"
echo "=================================================="

# Check AWS CLI installation
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI and credentials verified${NC}"

# Get account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${BLUE}📋 Account ID: ${ACCOUNT_ID}${NC}"

# Create IAM role for Lambda
echo -e "\n${BLUE}🔐 Creating IAM role...${NC}"
ROLE_ARN=$(aws iam create-role \
    --role-name ${ROLE_NAME} \
    --assume-role-policy-document '{
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
    }' \
    --query 'Role.Arn' \
    --output text 2>/dev/null || \
    aws iam get-role --role-name ${ROLE_NAME} --query 'Role.Arn' --output text)

echo -e "${GREEN}✅ IAM role created: ${ROLE_ARN}${NC}"

# Attach basic execution policy
echo -e "${BLUE}📋 Attaching basic execution policy...${NC}"
aws iam attach-role-policy \
    --role-name ${ROLE_NAME} \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create custom policy for DynamoDB access
echo -e "${BLUE}📋 Creating custom policy for DynamoDB access...${NC}"
aws iam put-role-policy \
    --role-name ${ROLE_NAME} \
    --policy-name ${POLICY_NAME} \
    --policy-document '{
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
                "Resource": "arn:aws:dynamodb:'${REGION}':'${ACCOUNT_ID}':table/Twilly"
            },
            {
                "Effect": "Allow",
                "Action": [
                    "execute-api:ManageConnections"
                ],
                "Resource": "arn:aws:execute-api:'${REGION}':'${ACCOUNT_ID}':*/*/@connections/*"
            }
        ]
    }'

echo -e "${GREEN}✅ Custom policy attached${NC}"

# Wait for role to be available
echo -e "${BLUE}⏳ Waiting for IAM role to be available...${NC}"
aws iam wait role-exists --role-name ${ROLE_NAME}

# Create deployment package
echo -e "\n${BLUE}📦 Creating deployment package...${NC}"
cd "$(dirname "$0")"

# Install dependencies if package.json exists
if [ -f "package.json" ]; then
    echo -e "${BLUE}📥 Installing dependencies...${NC}"
    npm install --production
fi

# Create ZIP file
echo -e "${BLUE}🗜️ Creating ZIP file...${NC}"
zip -r websocket-brain.zip . -x "*.git*" "*.md" "*.sh" "node_modules/.cache/*" "*.test.js"

echo -e "${GREEN}✅ Deployment package created: websocket-brain.zip${NC}"

# Create or update Lambda function
echo -e "\n${BLUE}🚀 Creating/updating Lambda function...${NC}"
if aws lambda get-function --function-name ${FUNCTION_NAME} --region ${REGION} &>/dev/null; then
    echo -e "${YELLOW}⚠️ Function already exists, updating...${NC}"
    
    # Update function code
    aws lambda update-function-code \
        --function-name ${FUNCTION_NAME} \
        --zip-file fileb://websocket-brain.zip \
        --region ${REGION}
    
    # Update function configuration
    aws lambda update-function-configuration \
        --function-name ${FUNCTION_NAME} \
        --timeout ${TIMEOUT} \
        --memory-size ${MEMORY_SIZE} \
        --region ${REGION}
        
    echo -e "${GREEN}✅ Lambda function updated${NC}"
else
    echo -e "${BLUE}📝 Creating new Lambda function...${NC}"
    
    aws lambda create-function \
        --function-name ${FUNCTION_NAME} \
        --runtime ${RUNTIME} \
        --role ${ROLE_ARN} \
        --handler ${HANDLER} \
        --zip-file fileb://websocket-brain.zip \
        --timeout ${TIMEOUT} \
        --memory-size ${MEMORY_SIZE} \
        --region ${REGION} \
        --description "Centralized WebSocket brain for all Twilly WebSocket interactions"
        
    echo -e "${GREEN}✅ Lambda function created${NC}"
fi

# Get function ARN
FUNCTION_ARN=$(aws lambda get-function --function-name ${FUNCTION_NAME} --region ${REGION} --query 'Configuration.FunctionArn' --output text)
echo -e "${GREEN}✅ Function ARN: ${FUNCTION_ARN}${NC}"

# Create API Gateway WebSocket API
echo -e "\n${BLUE}🌐 Creating API Gateway WebSocket API...${NC}"
API_NAME="twilly-websocket-api"
API_ID=$(aws apigatewayv2 create-api \
    --name ${API_NAME} \
    --protocol-type WEBSOCKET \
    --route-selection-expression '$request.body.action' \
    --query 'ApiId' \
    --output text 2>/dev/null || \
    aws apigatewayv2 get-apis --query "Items[?Name=='${API_NAME}'].ApiId" --output text)

echo -e "${GREEN}✅ WebSocket API created: ${API_ID}${NC}"

# Create routes
echo -e "${BLUE}🛣️ Creating WebSocket routes...${NC}"

# $connect route
aws apigatewayv2 create-route \
    --api-id ${API_ID} \
    --route-key '$connect' \
    --target "integrations/${FUNCTION_ARN}" \
    --region ${REGION} 2>/dev/null || echo "Connect route already exists"

# $disconnect route
aws apigatewayv2 create-route \
    --api-id ${API_ID} \
    --route-key '$disconnect' \
    --target "integrations/${FUNCTION_ARN}" \
    --region ${REGION} 2>/dev/null || echo "Disconnect route already exists"

# $default route
aws apigatewayv2 create-route \
    --api-id ${API_ID} \
    --route-key '$default' \
    --target "integrations/${FUNCTION_ARN}" \
    --region ${REGION} 2>/dev/null || echo "Default route already exists"

echo -e "${GREEN}✅ WebSocket routes created${NC}"

# Create integration
echo -e "${BLUE}🔗 Creating Lambda integration...${NC}"
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --api-id ${API_ID} \
    --integration-type AWS_PROXY \
    --integration-uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${FUNCTION_ARN}/invocations" \
    --query 'IntegrationId' \
    --output text 2>/dev/null || \
    aws apigatewayv2 get-integrations --api-id ${API_ID} --query 'Items[0].IntegrationId' --output text)

echo -e "${GREEN}✅ Integration created: ${INTEGRATION_ID}${NC}"

# Add Lambda permission for API Gateway
echo -e "${BLUE}🔐 Adding Lambda permission...${NC}"
aws lambda add-permission \
    --function-name ${FUNCTION_NAME} \
    --statement-id apigateway-websocket-access \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" \
    --region ${REGION} 2>/dev/null || echo "Permission already exists"

# Deploy API
echo -e "${BLUE}🚀 Deploying WebSocket API...${NC}"
STAGE_NAME="production"
aws apigatewayv2 create-deployment \
    --api-id ${API_ID} \
    --region ${REGION} 2>/dev/null || echo "Deployment already exists"

# Create stage if it doesn't exist
aws apigatewayv2 create-stage \
    --api-id ${API_ID} \
    --stage-name ${STAGE_NAME} \
    --region ${REGION} 2>/dev/null || echo "Stage already exists"

# Get WebSocket URL
WEBSOCKET_URL="wss://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE_NAME}"
echo -e "${GREEN}✅ WebSocket URL: ${WEBSOCKET_URL}${NC}"

# Clean up
echo -e "\n${BLUE}🧹 Cleaning up...${NC}"
rm -f websocket-brain.zip

echo -e "\n${GREEN}🎉 WebSocket Brain deployment completed!${NC}"
echo "=================================================="
echo -e "${BLUE}📋 Summary:${NC}"
echo -e "  Function Name: ${FUNCTION_NAME}"
echo -e "  Function ARN: ${FUNCTION_ARN}"
echo -e "  API ID: ${API_ID}"
echo -e "  WebSocket URL: ${WEBSOCKET_URL}"
echo -e "  Stage: ${STAGE_NAME}"
echo -e "  Region: ${REGION}"

echo -e "\n${YELLOW}📝 Next steps:${NC}"
echo "1. Update your frontend WebSocket URL to: ${WEBSOCKET_URL}"
echo "2. Test the WebSocket connection"
echo "3. Monitor Lambda function logs in CloudWatch"
echo "4. Set up CloudWatch alarms for monitoring"

echo -e "\n${BLUE}🔍 To view logs:${NC}"
echo "aws logs tail /aws/lambda/${FUNCTION_NAME} --follow --region ${REGION}"

echo -e "\n${BLUE}📊 To test the WebSocket:${NC}"
echo "wscat -c ${WEBSOCKET_URL}"
echo "Then send: {\"type\": \"subscribe\", \"targetType\": \"channels\"}"
