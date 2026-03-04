#!/bin/bash

# Set AWS Account ID
AWS_ACCOUNT_ID="142770202579"

echo "Deploying update-episode-visibility Lambda function..."

# Create deployment package
zip -r update-episode-visibility.zip update-episode-visibility.js

# Update the Lambda function
aws lambda update-function-code \
  --function-name update-episode-visibility \
  --zip-file fileb://update-episode-visibility.zip \
  --region us-east-1

# Clean up
rm update-episode-visibility.zip

echo "update-episode-visibility Lambda function deployed successfully!" 