#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Updating URL Redirect Lambda for iPhone Messages compatibility...${NC}"

# Configuration
REGION="us-east-1"
FUNCTION_NAME="UrlRedirectFunction"

echo -e "${YELLOW}📦 Creating deployment package...${NC}"

# Create deployment directory
mkdir -p deploy/url-redirect-simple

# Copy the simplified Lambda code
cp lambda-url-shortener-get-simple.js deploy/url-redirect-simple/index.js

# Create ZIP file
cd deploy/url-redirect-simple && zip -r ../url-redirect-simple.zip . && cd ../..

echo -e "${GREEN}✅ Deployment package created${NC}"

# Update URL Redirect Function
echo -e "${YELLOW}🔄 Updating URL Redirect Function...${NC}"
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://deploy/url-redirect-simple.zip \
    --region $REGION

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ URL Redirect Function updated successfully${NC}"
    echo -e "${GREEN}🎉 The lambda now uses simplified redirects that should work better with iPhone Messages!${NC}"
else
    echo -e "${RED}❌ Failed to update URL Redirect Function${NC}"
    exit 1
fi

# Clean up deployment files
echo -e "${YELLOW}🧹 Cleaning up deployment files...${NC}"
rm -rf deploy/
rm -f deploy/*.zip

echo -e "${GREEN}✅ All done!${NC}"
echo -e "${YELLOW}💡 The URL redirect lambda has been updated with simplified logic for better iPhone Messages compatibility.${NC}" 