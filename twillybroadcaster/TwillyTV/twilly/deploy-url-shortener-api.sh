#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting URL Shortener API Gateway deployment...${NC}"

# Configuration
REGION="us-east-1"
STAGE="default"
API_NAME="twilly-url-shortener-api"

# Function names
URL_SHORTENER_FUNCTION="UrlShortenerFunction"
URL_REDIRECT_FUNCTION="UrlRedirectFunction"

echo -e "${YELLOW}📦 Creating deployment packages...${NC}"

# Create deployment directories
mkdir -p deploy/url-shortener
mkdir -p deploy/url-redirect

# Copy Lambda code to deployment directories
cp lambda-url-shortener-post.js deploy/url-shortener/index.js
cp lambda-url-shortener-get.js deploy/url-redirect/index.js

# Create ZIP files
cd deploy/url-shortener && zip -r ../url-shortener.zip . && cd ../..
cd deploy/url-redirect && zip -r ../url-redirect.zip . && cd ../..

echo -e "${GREEN}✅ Deployment packages created${NC}"

# Update URL Shortener Function
echo -e "${YELLOW}🔄 Updating URL Shortener Function...${NC}"
aws lambda update-function-code \
    --function-name $URL_SHORTENER_FUNCTION \
    --zip-file fileb://deploy/url-shortener.zip \
    --region $REGION

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ URL Shortener Function updated successfully${NC}"
else
    echo -e "${RED}❌ Failed to update URL Shortener Function${NC}"
    exit 1
fi

# Update URL Redirect Function
echo -e "${YELLOW}🔄 Updating URL Redirect Function...${NC}"
aws lambda update-function-code \
    --function-name $URL_REDIRECT_FUNCTION \
    --zip-file fileb://deploy/url-redirect.zip \
    --region $REGION

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ URL Redirect Function updated successfully${NC}"
else
    echo -e "${RED}❌ Failed to update URL Redirect Function${NC}"
    exit 1
fi

# Create or update API Gateway
echo -e "${YELLOW}🌐 Setting up API Gateway...${NC}"

# Check if API exists
API_ID=$(aws apigatewayv2 get-apis --region $REGION --query "Items[?Name=='$API_NAME'].ApiId" --output text)

if [ -z "$API_ID" ] || [ "$API_ID" == "None" ]; then
    echo -e "${YELLOW}📝 Creating new API Gateway...${NC}"
    
    # Create HTTP API
    API_ID=$(aws apigatewayv2 create-api \
        --name $API_NAME \
        --protocol-type HTTP \
        --target "arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$URL_SHORTENER_FUNCTION" \
        --region $REGION \
        --query 'ApiId' \
        --output text)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ API Gateway created with ID: $API_ID${NC}"
    else
        echo -e "${RED}❌ Failed to create API Gateway${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ API Gateway already exists with ID: $API_ID${NC}"
fi

# Get the default stage
STAGE_NAME=$(aws apigatewayv2 get-stages --api-id $API_ID --region $REGION --query 'Items[0].StageName' --output text)

if [ "$STAGE_NAME" == "None" ] || [ -z "$STAGE_NAME" ]; then
    echo -e "${YELLOW}📝 Creating default stage...${NC}"
    aws apigatewayv2 create-stage \
        --api-id $API_ID \
        --stage-name $STAGE \
        --region $REGION
    
    STAGE_NAME=$STAGE
fi

# Create integration for URL shortener (POST)
echo -e "${YELLOW}🔗 Creating API Gateway integration for URL shortener...${NC}"

# Get integration ID for shortener
INTEGRATION_ID_SHORTENER=$(aws apigatewayv2 get-integrations --api-id $API_ID --region $REGION --query "Items[?IntegrationUri=='arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$URL_SHORTENER_FUNCTION'].IntegrationId" --output text)

if [ -z "$INTEGRATION_ID_SHORTENER" ] || [ "$INTEGRATION_ID_SHORTENER" == "None" ]; then
    # Create integration
    INTEGRATION_ID_SHORTENER=$(aws apigatewayv2 create-integration \
        --api-id $API_ID \
        --integration-type AWS_PROXY \
        --integration-uri "arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$URL_SHORTENER_FUNCTION" \
        --payload-format-version "2.0" \
        --region $REGION \
        --query 'IntegrationId' \
        --output text)
    
    echo -e "${GREEN}✅ URL Shortener integration created with ID: $INTEGRATION_ID_SHORTENER${NC}"
else
    echo -e "${GREEN}✅ URL Shortener integration already exists with ID: $INTEGRATION_ID_SHORTENER${NC}"
fi

# Create integration for URL redirect (GET)
echo -e "${YELLOW}🔗 Creating API Gateway integration for URL redirect...${NC}"

# Get integration ID for redirect
INTEGRATION_ID_REDIRECT=$(aws apigatewayv2 get-integrations --api-id $API_ID --region $REGION --query "Items[?IntegrationUri=='arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$URL_REDIRECT_FUNCTION'].IntegrationId" --output text)

if [ -z "$INTEGRATION_ID_REDIRECT" ] || [ "$INTEGRATION_ID_REDIRECT" == "None" ]; then
    # Create integration
    INTEGRATION_ID_REDIRECT=$(aws apigatewayv2 create-integration \
        --api-id $API_ID \
        --integration-type AWS_PROXY \
        --integration-uri "arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$URL_REDIRECT_FUNCTION" \
        --payload-format-version "2.0" \
        --region $REGION \
        --query 'IntegrationId' \
        --output text)
    
    echo -e "${GREEN}✅ URL Redirect integration created with ID: $INTEGRATION_ID_REDIRECT${NC}"
else
    echo -e "${GREEN}✅ URL Redirect integration already exists with ID: $INTEGRATION_ID_REDIRECT${NC}"
fi

# Create route for URL shortener (POST)
echo -e "${YELLOW}🛣️ Creating route for URL shortener...${NC}"

# Check if route exists
ROUTE_EXISTS=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='POST /url-shortener']" --output text)

if [ -z "$ROUTE_EXISTS" ] || [ "$ROUTE_EXISTS" == "None" ]; then
    aws apigatewayv2 create-route \
        --api-id $API_ID \
        --route-key "POST /url-shortener" \
        --target "integrations/$INTEGRATION_ID_SHORTENER" \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ URL Shortener route created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create URL Shortener route${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ URL Shortener route already exists${NC}"
fi

# Create route for URL redirect (GET)
echo -e "${YELLOW}🛣️ Creating route for URL redirect...${NC}"

# Check if route exists
ROUTE_EXISTS=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='GET /{shortId}']" --output text)

if [ -z "$ROUTE_EXISTS" ] || [ "$ROUTE_EXISTS" == "None" ]; then
    aws apigatewayv2 create-route \
        --api-id $API_ID \
        --route-key "GET /{shortId}" \
        --target "integrations/$INTEGRATION_ID_REDIRECT" \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ URL Redirect route created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create URL Redirect route${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ URL Redirect route already exists${NC}"
fi

# Add Lambda permission for API Gateway
echo -e "${YELLOW}🔐 Adding Lambda permissions...${NC}"

aws lambda add-permission \
    --function-name $URL_SHORTENER_FUNCTION \
    --statement-id apigateway-invoke-shortener \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*/url-shortener" \
    --region $REGION 2>/dev/null

aws lambda add-permission \
    --function-name $URL_REDIRECT_FUNCTION \
    --statement-id apigateway-invoke-redirect \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*/{shortId}" \
    --region $REGION 2>/dev/null

echo -e "${GREEN}✅ Lambda permissions added${NC}"

# Get the API Gateway URL
API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/$STAGE_NAME"
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo -e "${GREEN}📡 API Gateway URL: $API_URL${NC}"
echo -e "${YELLOW}💡 Add this to your environment variables:${NC}"
echo -e "${YELLOW}   URL_SHORTENER_API_URL=$API_URL${NC}"

# Clean up deployment files
echo -e "${YELLOW}🧹 Cleaning up deployment files...${NC}"
rm -rf deploy/
rm -f deploy/*.zip

echo -e "${GREEN}✅ All done!${NC}" 