#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting AWS Lambda and API Gateway deployment...${NC}"

# Configuration
REGION="us-east-1"
STAGE="prod"
API_NAME="twilly-menu-api"

# Function names
URL_REDIRECT_FUNCTION="UrlRedirectFunction"
URL_SHORTENER_FUNCTION="UrlShortenerFunction"
MENU_ITEMS_FUNCTION="MenuItemsFunction"

echo -e "${YELLOW}📦 Creating deployment packages...${NC}"

# Create deployment directories
mkdir -p deploy/url-redirect
mkdir -p deploy/url-shortener
mkdir -p deploy/menu-items

# Copy Lambda code to deployment directories
cp lambda-url-shortener-get.js deploy/url-redirect/index.js
cp lambda-url-shortener-post.js deploy/url-shortener/index.js
cp lambda-menu-items.js deploy/menu-items/index.js

# Create ZIP files
cd deploy/url-redirect && zip -r ../url-redirect.zip . && cd ../..
cd deploy/url-shortener && zip -r ../url-shortener.zip . && cd ../..
cd deploy/menu-items && zip -r ../menu-items.zip . && cd ../..

echo -e "${GREEN}✅ Deployment packages created${NC}"

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

# Check if Menu Items Function exists, create if not
echo -e "${YELLOW}🔍 Checking if Menu Items Function exists...${NC}"
FUNCTION_EXISTS=$(aws lambda get-function --function-name $MENU_ITEMS_FUNCTION --region $REGION 2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}📝 Creating new Menu Items Function...${NC}"
    
    # Get the execution role ARN from an existing function
    ROLE_ARN=$(aws lambda get-function --function-name $URL_REDIRECT_FUNCTION --region $REGION --query 'Configuration.Role' --output text)
    
    aws lambda create-function \
        --function-name $MENU_ITEMS_FUNCTION \
        --runtime nodejs18.x \
        --role $ROLE_ARN \
        --handler index.handler \
        --zip-file fileb://deploy/menu-items.zip \
        --region $REGION \
        --timeout 30 \
        --memory-size 256
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Menu Items Function created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create Menu Items Function${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}🔄 Updating Menu Items Function...${NC}"
    aws lambda update-function-code \
        --function-name $MENU_ITEMS_FUNCTION \
        --zip-file fileb://deploy/menu-items.zip \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Menu Items Function updated successfully${NC}"
    else
        echo -e "${RED}❌ Failed to update Menu Items Function${NC}"
        exit 1
    fi
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
        --target "arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$MENU_ITEMS_FUNCTION" \
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

# Create integration for menu items
echo -e "${YELLOW}🔗 Creating API Gateway integration...${NC}"

# Get integration ID
INTEGRATION_ID=$(aws apigatewayv2 get-integrations --api-id $API_ID --region $REGION --query "Items[?IntegrationUri=='arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$MENU_ITEMS_FUNCTION'].IntegrationId" --output text)

if [ -z "$INTEGRATION_ID" ] || [ "$INTEGRATION_ID" == "None" ]; then
    # Create integration
    INTEGRATION_ID=$(aws apigatewayv2 create-integration \
        --api-id $API_ID \
        --integration-type AWS_PROXY \
        --integration-uri "arn:aws:lambda:$REGION:$(aws sts get-caller-identity --query Account --output text):function:$MENU_ITEMS_FUNCTION" \
        --region $REGION \
        --query 'IntegrationId' \
        --output text)
    
    echo -e "${GREEN}✅ Integration created with ID: $INTEGRATION_ID${NC}"
else
    echo -e "${GREEN}✅ Integration already exists with ID: $INTEGRATION_ID${NC}"
fi

# Create route for menu items
echo -e "${YELLOW}🛣️ Creating route for menu items...${NC}"

# Check if route exists
ROUTE_EXISTS=$(aws apigatewayv2 get-routes --api-id $API_ID --region $REGION --query "Items[?RouteKey=='POST /menu-items']" --output text)

if [ -z "$ROUTE_EXISTS" ] || [ "$ROUTE_EXISTS" == "None" ]; then
    aws apigatewayv2 create-route \
        --api-id $API_ID \
        --route-key "POST /menu-items" \
        --target "integrations/$INTEGRATION_ID" \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Route created successfully${NC}"
    else
        echo -e "${RED}❌ Failed to create route${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Route already exists${NC}"
fi

# Add Lambda permission for API Gateway
echo -e "${YELLOW}🔐 Adding Lambda permission...${NC}"

aws lambda add-permission \
    --function-name $MENU_ITEMS_FUNCTION \
    --statement-id apigateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$(aws sts get-caller-identity --query Account --output text):$API_ID/*/*/menu-items" \
    --region $REGION 2>/dev/null

echo -e "${GREEN}✅ Lambda permission added${NC}"

# Get the API Gateway URL
API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/$STAGE_NAME"
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo -e "${GREEN}📡 API Gateway URL: $API_URL${NC}"
echo -e "${YELLOW}💡 Add this to your environment variables:${NC}"
echo -e "${YELLOW}   API_GATEWAY_URL=$API_URL${NC}"

# Clean up deployment files
echo -e "${YELLOW}🧹 Cleaning up deployment files...${NC}"
rm -rf deploy/
rm -f deploy/*.zip

echo -e "${GREEN}✅ All done!${NC}" 