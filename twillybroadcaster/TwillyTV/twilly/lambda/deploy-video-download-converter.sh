#!/bin/bash

# Deploy video download converter Lambda function

FUNCTION_NAME="video-download-converter"
REGION="us-east-1"
HANDLER="video-download-converter.handler"
RUNTIME="nodejs18.x"
TIMEOUT=300
MEMORY_SIZE=1024
ACCOUNT_ID="142770202579"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/lambda-execution-role"

echo "Deploying video download converter Lambda function..."

# Create deployment package
zip -r function.zip video-download-converter.js package.json

# Create or update Lambda function
aws lambda create-function \
  --function-name $FUNCTION_NAME \
  --runtime $RUNTIME \
  --role $ROLE_ARN \
  --handler $HANDLER \
  --zip-file fileb://function.zip \
  --timeout $TIMEOUT \
  --memory-size $MEMORY_SIZE \
  --region $REGION \
  --environment Variables={} \
  || aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://function.zip \
  --region $REGION

# Clean up
rm function.zip

echo "Video download converter Lambda function deployed successfully!" 