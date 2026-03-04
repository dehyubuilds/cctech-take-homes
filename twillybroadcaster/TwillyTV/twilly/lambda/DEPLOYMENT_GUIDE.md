# Stripe Lambda Functions Deployment Guide

## Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js installed
- Access to AWS Lambda console

## Step 1: Prepare the Lambda Functions

```bash
# Navigate to lambda directory
cd lambda

# Install dependencies
npm install

# Create deployment packages
zip -r stripe-create-connect-account.zip stripe-create-connect-account.js package.json node_modules/
zip -r stripe-subscription-payment.zip stripe-subscription-payment.js package.json node_modules/
```

## Step 2: Deploy via AWS Console

### Option A: AWS Lambda Console (Recommended)

1. **Go to AWS Lambda Console**
   - Navigate to https://console.aws.amazon.com/lambda/
   - Click "Create function"

2. **Create stripe-create-connect-account**
   - Function name: `stripe-create-connect-account`
   - Runtime: Node.js 18.x
   - Architecture: x86_64
   - Click "Create function"

3. **Upload Code**
   - In the "Code" tab, click "Upload from"
   - Select ".zip file"
   - Upload `stripe-create-connect-account.zip`
   - Click "Save"

4. **Configure Settings**
   - Go to "Configuration" tab
   - Set timeout to 30 seconds
   - Set memory to 256 MB
   - Save changes

5. **Repeat for stripe-subscription-payment**
   - Create new function: `stripe-subscription-payment`
   - Upload `stripe-subscription-payment.zip`
   - Same configuration settings

### Option B: AWS CLI

```bash
# Get your Lambda execution role ARN
aws iam get-role --role-name lambda-execution-role

# Update the ROLE_ARN in deploy-stripe-lambdas.sh
# Then run:
chmod +x deploy-stripe-lambdas.sh
./deploy-stripe-lambdas.sh
```

## Step 3: Test the Functions

### Test stripe-create-connect-account
```json
{
  "body": "{\"userId\":\"test-user-123\",\"username\":\"testuser\",\"email\":\"test@example.com\"}"
}
```

### Test stripe-subscription-payment
```json
{
  "body": "{\"subscriptionId\":\"sub_123\",\"channelId\":\"channel_456\",\"amount\":1000,\"subscriberId\":\"user_789\"}"
}
```

## Step 4: Update IAM Permissions

Your Lambda execution role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/Twilly"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:us-east-1:*:*"
    }
  ]
}
```

## Troubleshooting

### Common Issues:
1. **Role ARN not found**: Create or update your Lambda execution role
2. **DynamoDB access denied**: Add DynamoDB permissions to your role
3. **Stripe API errors**: Verify your Stripe secret key is correct
4. **Timeout errors**: Increase timeout to 30 seconds

### Testing Locally:
```bash
# Test the functions locally (optional)
node stripe-create-connect-account.js
node stripe-subscription-payment.js
```

## Next Steps

After deployment:
1. Test the account page Payouts section
2. Try creating a Stripe Connect account
3. Test the collaborator accept flow
4. Verify DynamoDB records are created correctly 