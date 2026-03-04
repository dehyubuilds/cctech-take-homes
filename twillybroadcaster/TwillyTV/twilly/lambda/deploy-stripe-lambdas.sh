#!/bin/bash

# Deploy Stripe Connect Lambda Functions
echo "🚀 Deploying Stripe Connect Lambda Functions..."

# Set variables
REGION="us-east-1"
ROLE_ARN="arn:aws:iam::142770202579:role/service-role/UrlRedirectFunction-role-6mnu244n"
FUNCTION_NAME_1="stripe-create-connect-account"
FUNCTION_NAME_2="stripe-subscription-payment"

# Create deployment package for stripe-create-connect-account
echo "📦 Creating deployment package for $FUNCTION_NAME_1..."
cd lambda
npm install
zip -r $FUNCTION_NAME_1.zip stripe-create-connect-account.js package.json node_modules/

# Deploy stripe-create-connect-account
echo "📤 Deploying $FUNCTION_NAME_1..."
aws lambda create-function \
  --function-name $FUNCTION_NAME_1 \
  --runtime nodejs18.x \
  --role $ROLE_ARN \
  --handler stripe-create-connect-account.handler \
  --zip-file fileb://$FUNCTION_NAME_1.zip \
  --region $REGION \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables='{}' || \
aws lambda update-function-code \
  --function-name $FUNCTION_NAME_1 \
  --zip-file fileb://$FUNCTION_NAME_1.zip \
  --region $REGION

# Create deployment package for stripe-subscription-payment
echo "📦 Creating deployment package for $FUNCTION_NAME_2..."
zip -r $FUNCTION_NAME_2.zip stripe-subscription-payment.js package.json node_modules/

# Deploy stripe-subscription-payment
echo "📤 Deploying $FUNCTION_NAME_2..."
aws lambda create-function \
  --function-name $FUNCTION_NAME_2 \
  --runtime nodejs18.x \
  --role $ROLE_ARN \
  --handler stripe-subscription-payment.handler \
  --zip-file fileb://$FUNCTION_NAME_2.zip \
  --region $REGION \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables='{}' || \
aws lambda update-function-code \
  --function-name $FUNCTION_NAME_2 \
  --zip-file fileb://$FUNCTION_NAME_2.zip \
  --region $REGION

# Clean up
echo "🧹 Cleaning up..."
rm $FUNCTION_NAME_1.zip $FUNCTION_NAME_2.zip

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update the ROLE_ARN in this script with your actual Lambda execution role"
echo "2. Run: chmod +x lambda/deploy-stripe-lambdas.sh"
echo "3. Run: ./lambda/deploy-stripe-lambdas.sh"
echo "4. Test the Stripe Connect flow in your app" 