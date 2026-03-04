#!/bin/bash
# Deploy release-scheduled-drops Lambda + EventBridge rule (every 15 min).
# Requires GSI "ReleaseSchedule" on table Twilly (run add-release-schedule-gsi.sh first).
# Uses AWS CLI. Set REGION/ACCOUNT_ID or they are detected.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAMBDA_SOURCE="$SCRIPT_DIR/../lambda/release-scheduled-drops.js"
REGION="${1:-us-east-1}"
ENV="${2:-dev}"

if [ ! -f "$LAMBDA_SOURCE" ]; then
  echo "Lambda source not found: $LAMBDA_SOURCE"
  exit 1
fi

command -v aws >/dev/null 2>&1 || { echo "AWS CLI required."; exit 1; }
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) || ACCOUNT_ID="142770202579"
FUNCTION_NAME="release-scheduled-drops"
ROLE_NAME="release-scheduled-drops-role-$ENV"
RULE_NAME="release-scheduled-drops-every-15min"
TABLE_NAME="Twilly"
INDEX_NAME="ReleaseSchedule"

echo "Deploying $FUNCTION_NAME (region=$REGION, account=$ACCOUNT_ID)"

# Build Lambda zip from single file (no node_modules; Lambda uses built-in AWS SDK v3 in Node 18+)
WORK_DIR=$(mktemp -d)
cp "$LAMBDA_SOURCE" "$WORK_DIR/index.js"
cd "$WORK_DIR"
zip -q -r release-scheduled-drops.zip index.js
cd - >/dev/null

# IAM role for Lambda
TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'
aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST_POLICY" 2>/dev/null || true
aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole 2>/dev/null || true

# Policy: Query on GSI ReleaseSchedule + UpdateItem on Twilly (no Scan)
DYNAMO_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:Query"],
      "Resource": "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}/index/${INDEX_NAME}"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:UpdateItem"],
      "Resource": "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}"
    }
  ]
}
EOF
)
echo "$DYNAMO_POLICY" > "$WORK_DIR/dynamo-policy.json"
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name DynamoDBReleaseSchedule --policy-document file://"$WORK_DIR/dynamo-policy.json"

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query Role.Arn --output text)
# Allow IAM to propagate
sleep 3

# Create or update Lambda
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "Updating Lambda code..."
  aws lambda update-function-code --function-name "$FUNCTION_NAME" --zip-file fileb://"$WORK_DIR/release-scheduled-drops.zip" --region "$REGION"
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
else
  echo "Creating Lambda..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs18.x \
    --role "$ROLE_ARN" \
    --handler "index.handler" \
    --zip-file fileb://"$WORK_DIR/release-scheduled-drops.zip" \
    --timeout 60 \
    --memory-size 128 \
    --environment "Variables={TABLE_NAME=$TABLE_NAME}" \
    --region "$REGION"
fi

# EventBridge rule: every 15 minutes
RULE_ARN="arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${RULE_NAME}"
aws events put-rule \
  --name "$RULE_NAME" \
  --schedule-expression "rate(15 minutes)" \
  --state ENABLED \
  --description "Invoke release-scheduled-drops Lambda every 15 min" \
  --region "$REGION" 2>/dev/null || true

LAMBDA_ARN=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" --query Configuration.FunctionArn --output text)
aws events put-targets --rule "$RULE_NAME" --targets "Id=1,Arn=$LAMBDA_ARN" --region "$REGION" 2>/dev/null || true

# Allow EventBridge to invoke Lambda
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id "EventBridgeInvoke" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "$RULE_ARN" \
  --region "$REGION" 2>/dev/null || true

rm -rf "$WORK_DIR"
echo "Done. Lambda: $FUNCTION_NAME; EventBridge rule: $RULE_NAME (rate 15 min)."
echo "Ensure GSI $INDEX_NAME exists on table $TABLE_NAME (run add-release-schedule-gsi.sh if not)."
