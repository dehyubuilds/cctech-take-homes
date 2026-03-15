#!/usr/bin/env bash
# EventBridge Scheduler: trigger Lambda daily (e.g. 8 AM UTC).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$ROOT_DIR/.env" 2>/dev/null || true
REGION="${AWS_REGION:-us-east-1}"
FUNC_NAME="march-madness-v1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Schedule expression: 8 AM UTC daily
SCHEDULE="cron(0 8 * * ? *)"
aws events put-rule --name "march-madness-daily" --schedule-expression "$SCHEDULE" --state ENABLED --region "$REGION"
aws events put-targets --rule "march-madness-daily" --targets "Id"="1","Arn"="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNC_NAME}" --region "$REGION"
aws lambda add-permission --function-name "$FUNC_NAME" --statement-id events --action lambda:InvokeFunction --principal events.amazonaws.com --source-arn "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/march-madness-daily" --region "$REGION" 2>/dev/null || true
echo "Schedule created: 8 AM UTC daily"
