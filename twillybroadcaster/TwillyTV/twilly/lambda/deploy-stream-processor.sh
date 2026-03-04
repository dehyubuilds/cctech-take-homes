#!/bin/bash

# Deploy Stream Processor Lambda Function
# This Lambda processes FLV files from S3 and generates HLS variants + thumbnails

set -e

echo "🚀 Deploying Stream Processor Lambda Function..."

# Configuration
REGION="us-east-1"
FUNCTION_NAME="stream-processor"
RUNTIME="nodejs18.x"
HANDLER="stream-processor.handler"
TIMEOUT=900  # 15 minutes (max for Lambda)
MEMORY_SIZE=3008  # Max memory for better performance
PROCESSING_BUCKET="twilly-streaming-processing"
OUTPUT_BUCKET="theprivatecollection"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if we're in the lambda directory
if [ ! -f "stream-processor.js" ]; then
    echo -e "${RED}❌ stream-processor.js not found. Please run this script from the lambda directory.${NC}"
    exit 1
fi

# Create deployment package
echo -e "\n${BLUE}📦 Creating deployment package...${NC}"
ZIP_FILE="${FUNCTION_NAME}.zip"

# Install dependencies
echo -e "${BLUE}📥 Installing dependencies...${NC}"
if [ -f "stream-processor-package.json" ]; then
    cp stream-processor-package.json package.json
    npm install --production
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️ No package.json found, creating minimal one...${NC}"
    cat > package.json <<EOF
{
  "name": "stream-processor",
  "version": "1.0.0",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.490.0"
  }
}
EOF
    npm install --production
fi

# Create zip file
echo -e "${BLUE}📦 Zipping files...${NC}"
zip -r ${ZIP_FILE} stream-processor.js node_modules/ package.json 2>/dev/null || zip -r ${ZIP_FILE} stream-processor.js

# Get or create IAM role
echo -e "\n${BLUE}🔐 Setting up IAM role...${NC}"
ROLE_NAME="lambda-stream-processor-role"
ROLE_ARN=""

# Check if role exists
if aws iam get-role --role-name ${ROLE_NAME} --region ${REGION} &>/dev/null; then
    echo -e "${YELLOW}⚠️ Role ${ROLE_NAME} already exists${NC}"
    ROLE_ARN=$(aws iam get-role --role-name ${ROLE_NAME} --query 'Role.Arn' --output text)
else
    echo -e "${BLUE}📝 Creating IAM role...${NC}"
    
    # Create trust policy
    cat > /tmp/trust-policy.json <<EOF
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

    # Create role
    ROLE_ARN=$(aws iam create-role \
        --role-name ${ROLE_NAME} \
        --assume-role-policy-document file:///tmp/trust-policy.json \
        --query 'Role.Arn' \
        --output text)
    
    echo -e "${GREEN}✅ Role created: ${ROLE_ARN}${NC}"
    
    # Attach basic Lambda execution policy
    aws iam attach-role-policy \
        --role-name ${ROLE_NAME} \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    
    # Create and attach custom policy for S3 access
    cat > /tmp/s3-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::${PROCESSING_BUCKET}/*",
        "arn:aws:s3:::${OUTPUT_BUCKET}/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${PROCESSING_BUCKET}",
        "arn:aws:s3:::${OUTPUT_BUCKET}"
      ]
    }
  ]
}
EOF

    aws iam put-role-policy \
        --role-name ${ROLE_NAME} \
        --policy-name StreamProcessorS3Policy \
        --policy-document file:///tmp/s3-policy.json
    
    echo -e "${GREEN}✅ IAM policies attached${NC}"
    
    # Wait for role to be ready
    echo -e "${BLUE}⏳ Waiting for IAM role to be ready...${NC}"
    sleep 10
fi

# Create or update Lambda function
echo -e "\n${BLUE}🚀 Creating/updating Lambda function...${NC}"
if aws lambda get-function --function-name ${FUNCTION_NAME} --region ${REGION} &>/dev/null; then
    echo -e "${YELLOW}⚠️ Function already exists, updating...${NC}"
    
    # Update function code
    aws lambda update-function-code \
        --function-name ${FUNCTION_NAME} \
        --zip-file fileb://${ZIP_FILE} \
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
        --zip-file fileb://${ZIP_FILE} \
        --timeout ${TIMEOUT} \
        --memory-size ${MEMORY_SIZE} \
        --region ${REGION} \
        --description "Processes FLV files from S3 and generates HLS variants + thumbnails"
        
    echo -e "${GREEN}✅ Lambda function created${NC}"
fi

# Configure S3 event trigger
echo -e "\n${BLUE}🔗 Configuring S3 event trigger...${NC}"

# Check if bucket exists
if ! aws s3 ls "s3://${PROCESSING_BUCKET}" &>/dev/null; then
    echo -e "${YELLOW}⚠️ Processing bucket ${PROCESSING_BUCKET} does not exist. Creating...${NC}"
    aws s3 mb "s3://${PROCESSING_BUCKET}" --region ${REGION}
    echo -e "${GREEN}✅ Bucket created${NC}"
fi

# Get function ARN
FUNCTION_ARN=$(aws lambda get-function --function-name ${FUNCTION_NAME} --region ${REGION} --query 'Configuration.FunctionArn' --output text)
echo -e "${GREEN}✅ Function ARN: ${FUNCTION_ARN}${NC}"

# Attach FFmpeg layer if it exists
echo -e "\n${BLUE}🔗 Attaching FFmpeg layer...${NC}"
FFMPEG_LAYER_ARN=$(aws lambda list-layer-versions --layer-name ffmpeg-layer --region ${REGION} --query 'LayerVersions[0].LayerVersionArn' --output text 2>/dev/null || echo "")

if [ -n "${FFMPEG_LAYER_ARN}" ] && [ "${FFMPEG_LAYER_ARN}" != "None" ]; then
    echo -e "${BLUE}📝 Attaching FFmpeg layer: ${FFMPEG_LAYER_ARN}${NC}"
    aws lambda update-function-configuration \
        --function-name ${FUNCTION_NAME} \
        --layers ${FFMPEG_LAYER_ARN} \
        --region ${REGION} 2>/dev/null || echo -e "${YELLOW}⚠️ Could not attach layer (may already be attached)${NC}"
    echo -e "${GREEN}✅ FFmpeg layer attached${NC}"
else
    echo -e "${YELLOW}⚠️ FFmpeg layer not found. Please create it using ffmpeg-layer-setup.md${NC}"
    echo -e "${YELLOW}   The Lambda will try to use system FFmpeg, which may not be available.${NC}"
fi

# Check if notification already exists
NOTIFICATION_ID=$(aws s3api get-bucket-notification-configuration \
    --bucket ${PROCESSING_BUCKET} \
    --query 'LambdaFunctionConfigurations[?LambdaFunctionArn==`'${FUNCTION_ARN}'`].Id' \
    --output text 2>/dev/null || echo "")

if [ -z "${NOTIFICATION_ID}" ] || [ "${NOTIFICATION_ID}" == "None" ]; then
    echo -e "${BLUE}📝 Adding S3 event notification...${NC}"
    
    # Grant S3 permission to invoke Lambda
    aws lambda add-permission \
        --function-name ${FUNCTION_NAME} \
        --principal s3.amazonaws.com \
        --statement-id s3-trigger-${FUNCTION_NAME} \
        --action "lambda:InvokeFunction" \
        --source-arn "arn:aws:s3:::${PROCESSING_BUCKET}" \
        --region ${REGION} 2>/dev/null || echo -e "${YELLOW}⚠️ Permission may already exist${NC}"
    
    # Create notification configuration
    cat > /tmp/notification.json <<EOF
{
  "LambdaFunctionConfigurations": [
    {
      "Id": "stream-processor-trigger",
      "LambdaFunctionArn": "${FUNCTION_ARN}",
      "Events": ["s3:ObjectCreated:*"],
      "Filter": {
        "Key": {
          "FilterRules": [
            {
              "Name": "prefix",
              "Value": "clips/"
            },
            {
              "Name": "suffix",
              "Value": ".flv"
            }
          ]
        }
      }
    }
  ]
}
EOF

    # Get existing notifications
    EXISTING=$(aws s3api get-bucket-notification-configuration --bucket ${PROCESSING_BUCKET} 2>/dev/null || echo '{}')
    
    # Merge with existing notifications
    if [ "$(echo $EXISTING | jq -r '.LambdaFunctionConfigurations // empty')" != "" ]; then
        echo -e "${YELLOW}⚠️ Existing notifications found, merging...${NC}"
        # This is a simplified merge - in production you might want more sophisticated merging
        MERGED=$(echo $EXISTING | jq ".LambdaFunctionConfigurations += $(cat /tmp/notification.json | jq '.LambdaFunctionConfigurations')")
        echo "$MERGED" > /tmp/notification.json
    fi
    
    # Apply notification configuration
    aws s3api put-bucket-notification-configuration \
        --bucket ${PROCESSING_BUCKET} \
        --notification-configuration file:///tmp/notification.json
    
    echo -e "${GREEN}✅ S3 event trigger configured${NC}"
else
    echo -e "${YELLOW}⚠️ S3 event notification already exists${NC}"
fi

# Clean up
echo -e "\n${BLUE}🧹 Cleaning up...${NC}"
rm -f ${ZIP_FILE}
rm -f /tmp/trust-policy.json /tmp/s3-policy.json /tmp/notification.json

echo -e "\n${GREEN}🎉 Stream Processor Lambda deployed successfully!${NC}"
echo -e "\n${BLUE}📋 Summary:${NC}"
echo -e "   Function Name: ${FUNCTION_NAME}"
echo -e "   Function ARN: ${FUNCTION_ARN}"
echo -e "   Processing Bucket: ${PROCESSING_BUCKET}"
echo -e "   Output Bucket: ${OUTPUT_BUCKET}"
echo -e "   Trigger: S3 ObjectCreated events on ${PROCESSING_BUCKET}/clips/*.flv"
echo -e "\n${BLUE}📝 Next steps:${NC}"
echo -e "   1. Test by uploading an FLV file to s3://${PROCESSING_BUCKET}/clips/{streamKey}/{filename}.flv"
echo -e "   2. Check CloudWatch logs for the Lambda function"
echo -e "   3. Verify HLS files are created in s3://${OUTPUT_BUCKET}/clips/{streamKey}/"
