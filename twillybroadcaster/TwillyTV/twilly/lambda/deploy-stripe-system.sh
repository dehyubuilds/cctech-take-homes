#!/bin/bash

# Deploy Stripe Integration System
echo "🚀 Deploying Stripe Integration System..."

# Set variables
REGION="us-east-1"
FUNCTION_NAME_1="stripe-create-connect-account"
FUNCTION_NAME_2="stripe-subscription-payment"
ZIP_FILE_1="stripe-create-connect-account.zip"
ZIP_FILE_2="stripe-subscription-payment.zip"

# Create deployment packages
echo "📦 Creating deployment packages..."

# Package 1: Stripe Connect Account Creation
zip -r $ZIP_FILE_1 stripe-create-connect-account.js

# Package 2: Stripe Subscription Payment Processing
zip -r $ZIP_FILE_2 stripe-subscription-payment.js

# Deploy Lambda functions
echo "🔧 Deploying Lambda functions..."

# Deploy stripe-create-connect-account
aws lambda update-function-code \
  --function-name $FUNCTION_NAME_1 \
  --zip-file fileb://$ZIP_FILE_1 \
  --region $REGION

if [ $? -eq 0 ]; then
  echo "✅ $FUNCTION_NAME_1 deployed successfully"
else
  echo "❌ Failed to deploy $FUNCTION_NAME_1"
  exit 1
fi

# Deploy stripe-subscription-payment
aws lambda update-function-code \
  --function-name $FUNCTION_NAME_2 \
  --zip-file fileb://$ZIP_FILE_2 \
  --region $REGION

if [ $? -eq 0 ]; then
  echo "✅ $FUNCTION_NAME_2 deployed successfully"
else
  echo "❌ Failed to deploy $FUNCTION_NAME_2"
  exit 1
fi

# Clean up zip files
rm -f $ZIP_FILE_1 $ZIP_FILE_2

echo "🎉 Stripe Integration System deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Set up Stripe webhook endpoint: https://twilly.app/api/stripe/webhook"
echo "2. Configure webhook events: checkout.session.completed, invoice.payment_succeeded, customer.subscription.deleted, account.updated"
echo "3. Update webhook secret in server/api/stripe/webhook.post.js"
echo "4. Test the subscription flow on a series page"
echo ""
echo "🔗 Stripe Dashboard: https://dashboard.stripe.com" 