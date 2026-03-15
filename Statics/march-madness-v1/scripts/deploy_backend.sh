#!/usr/bin/env bash
# Create Lambda + API Gateway HTTP API, attach permissions. Uses AWS CLI only.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$ROOT_DIR/.env" 2>/dev/null || true
REGION="${AWS_REGION:-us-east-1}"
FUNC_NAME="march-madness-v1"
API_NAME="march-madness-api"
ROLE_NAME="march-madness-lambda-role"

echo "Packaging Lambda..."
"$SCRIPT_DIR/package_lambda.sh"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# Create role if not exists
aws iam get-role --role-name "$ROLE_NAME" 2>/dev/null || {
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
  echo "Waiting for role to be usable..."
  sleep 10
}

# Create or update Lambda
if aws lambda get-function --function-name "$FUNC_NAME" --region "$REGION" 2>/dev/null; then
  aws lambda update-function-code --function-name "$FUNC_NAME" --zip-file "fileb://$ROOT_DIR/lambda.zip" --region "$REGION"
  aws lambda update-function-configuration --function-name "$FUNC_NAME" \
    --environment "Variables={CBB_API_BASE_URL=$CBB_API_BASE_URL,CBB_API_KEY=$CBB_API_KEY,CBB_API_SECRET=$CBB_API_SECRET,STATICS_BASE_URL=$STATICS_BASE_URL,STATICS_API_KEY=$STATICS_API_KEY,STATICS_TABLE_NAME=$STATICS_TABLE_NAME,TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN,TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER,AWS_REGION=$REGION,DAILY_PICKS_TABLE=$DAILY_PICKS_TABLE,PREDICTIONS_LOG_TABLE=$PREDICTIONS_LOG_TABLE}" \
    --region "$REGION" 2>/dev/null || true
else
  aws lambda create-function --function-name "$FUNC_NAME" \
    --runtime python3.11 --role "$ROLE_ARN" --handler app.lambda_handler \
    --zip-file "fileb://$ROOT_DIR/lambda.zip" \
    --environment "Variables={CBB_API_BASE_URL=$CBB_API_BASE_URL,CBB_API_KEY=$CBB_API_KEY,STATICS_BASE_URL=$STATICS_BASE_URL,STATICS_API_KEY=$STATICS_API_KEY,STATICS_TABLE_NAME=$STATICS_TABLE_NAME,TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN,TWILIO_PHONE_NUMBER=$TWILIO_PHONE_NUMBER,AWS_REGION=$REGION,DAILY_PICKS_TABLE=march_madness_daily_picks,PREDICTIONS_LOG_TABLE=march_madness_predictions_log}" \
    --region "$REGION"
fi

# HTTP API
API_ID=$(aws apigatewayv2 get-apis --region "$REGION" --query "Items[?Name=='$API_NAME'].ApiId" --output text)
if [ -z "$API_ID" ] || [ "$API_ID" == "None" ]; then
  API_ID=$(aws apigatewayv2 create-api --name "$API_NAME" --protocol-type HTTP --target "arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNC_NAME}" --region "$REGION" --query ApiId --output text)
fi
echo "API ID: $API_ID"
aws lambda add-permission --function-name "$FUNC_NAME" --statement-id apigw --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" --region "$REGION" 2>/dev/null || true

INVOKE_URL=$(aws apigatewayv2 get-api --api-id "$API_ID" --region "$REGION" --query ApiEndpoint --output text)
echo "Invoke URL: $INVOKE_URL"
echo "Set frontend API_BASE or ?api=$INVOKE_URL"
