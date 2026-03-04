#!/bin/bash

# Deploy s3todynamo-fixed Lambda Function
echo "🚀 Deploying s3todynamo-fixed Lambda Function..."

# Configuration
REGION="us-east-2"  # Output bucket is in us-east-2
FUNCTION_NAME="s3todynamo"  # Function name from S3 notification config
LAMBDA_DIR="s3todynamo-fixed"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials are not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

# Navigate to Lambda directory
cd "$(dirname "$0")"
cd "$LAMBDA_DIR"

echo -e "${YELLOW}📦 Creating deployment package...${NC}"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install --production
fi

# Create deployment package (exclude node_modules/.cache and other unnecessary files)
echo "   Creating ZIP file..."
zip -r ../s3todynamo-fixed-deploy.zip . \
    -x "*.git*" \
    -x "*.DS_Store" \
    -x "node_modules/.cache/*" \
    -x "*.zip" \
    -x "*.log" \
    > /dev/null 2>&1

cd ..

# Check if function exists
echo -e "${YELLOW}🔍 Checking if function exists...${NC}"
FUNCTION_EXISTS=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null || echo "")

if [ -z "$FUNCTION_EXISTS" ]; then
    echo -e "${RED}❌ Function '$FUNCTION_NAME' not found in AWS Lambda.${NC}"
    echo -e "${YELLOW}   Please create the function first or update FUNCTION_NAME in this script.${NC}"
    echo -e "${YELLOW}   Available functions with 's3' or 'dynamo' in name:${NC}"
    aws lambda list-functions --region "$REGION" --query 'Functions[?contains(FunctionName, `s3`) || contains(FunctionName, `dynamo`) || contains(FunctionName, `S3`) || contains(FunctionName, `Dynamo`)].FunctionName' --output table
    rm -f s3todynamo-fixed-deploy.zip
    exit 1
fi

# Update function code
echo -e "${YELLOW}📤 Updating Lambda function code...${NC}"
aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://s3todynamo-fixed-deploy.zip \
    --region "$REGION" > /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Lambda function '$FUNCTION_NAME' updated successfully!${NC}"
    
    # Wait for update to complete
    echo -e "${YELLOW}⏳ Waiting for update to complete...${NC}"
    aws lambda wait function-updated \
        --function-name "$FUNCTION_NAME" \
        --region "$REGION"
    
    echo -e "${GREEN}✅ Deployment complete!${NC}"
    echo ""
    echo -e "${GREEN}📋 Summary:${NC}"
    echo "   Function: $FUNCTION_NAME"
    echo "   Region: $REGION"
    echo "   Package: s3todynamo-fixed-deploy.zip"
    echo ""
    echo -e "${YELLOW}💡 Changes deployed:${NC}"
    echo "   - Fixed path parsing bug (now uses streamKey from path directly)"
    echo "   - Special handling for Twilly TV channel (always uses master account)"
    echo "   - Improved getChannelOwner function with better fallbacks"
    echo "   - Enhanced masterEmail assignment logic for collaborator videos"
else
    echo -e "${RED}❌ Failed to update Lambda function${NC}"
    rm -f s3todynamo-fixed-deploy.zip
    exit 1
fi

# Clean up
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
rm -f s3todynamo-fixed-deploy.zip

echo -e "${GREEN}✅ All done!${NC}"
