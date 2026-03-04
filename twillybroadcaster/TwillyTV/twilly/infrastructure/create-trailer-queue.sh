#!/bin/bash
# Create SQS queue for Twilly TV trailer generation (separate from stream-processing queues).
# - twilly-trailer-dlq: dead-letter queue for failed trailer jobs
# - twilly-trailer-queue: main queue; messages go to DLQ after 3 failed receives.
# Run once. Safe to re-run (skips create if queue exists).
# Usage: ./create-trailer-queue.sh [region] [account-id]
#   region defaults to us-east-1; account-id optional (script will try to resolve).

set -e

REGION="${1:-us-east-1}"
ACCOUNT_ID="${2:-}"
DLQ_NAME="twilly-trailer-dlq"
QUEUE_NAME="twilly-trailer-queue"
MAX_RECEIVE_COUNT="3"

if [ -z "$ACCOUNT_ID" ]; then
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) || true
fi
if [ -z "$ACCOUNT_ID" ]; then
  echo "Could not resolve AWS account ID. Pass it as second argument or configure AWS CLI."
  exit 1
fi

echo "Region: $REGION, Account: $ACCOUNT_ID"
echo "Creating DLQ: $DLQ_NAME ..."

DLQ_URL=$(aws sqs create-queue \
  --queue-name "$DLQ_NAME" \
  --region "$REGION" \
  --output text --query 'QueueUrl' 2>/dev/null) || true

if [ -z "$DLQ_URL" ]; then
  DLQ_URL=$(aws sqs get-queue-url --queue-name "$DLQ_NAME" --region "$REGION" --query 'QueueUrl' --output text 2>/dev/null)
fi
if [ -z "$DLQ_URL" ]; then
  echo "Failed to create or get DLQ URL."
  exit 1
fi

DLQ_ARN=$(aws sqs get-queue-attributes \
  --queue-url "$DLQ_URL" \
  --attribute-names QueueArn \
  --region "$REGION" \
  --query 'Attributes.QueueArn' --output text)

echo "DLQ URL: $DLQ_URL"
echo "DLQ ARN: $DLQ_ARN"

# RedrivePolicy must be a JSON string value (escaped)
REDRIVE_POLICY_JSON="{\"deadLetterTargetArn\":\"$DLQ_ARN\",\"maxReceiveCount\":\"$MAX_RECEIVE_COUNT\"}"
echo "Creating main queue: $QUEUE_NAME with redrive policy ..."

MAIN_URL=$(aws sqs create-queue \
  --queue-name "$QUEUE_NAME" \
  --region "$REGION" \
  --attributes "{\"RedrivePolicy\":\"$REDRIVE_POLICY_JSON\"}" \
  --output text --query 'QueueUrl' 2>/dev/null) || true

if [ -z "$MAIN_URL" ]; then
  MAIN_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region "$REGION" --query 'QueueUrl' --output text 2>/dev/null)
  echo "Main queue already exists."
fi
if [ -z "$MAIN_URL" ]; then
  echo "Failed to create or get main queue URL."
  exit 1
fi

echo "Main queue URL: $MAIN_URL"
echo ""
echo "Done. Use these in your Lambda and API:"
echo "  TRAILER_QUEUE_URL=$MAIN_URL"
echo "  (Lambda needs: sqs:ReceiveMessage, sqs:DeleteMessage, sqs:GetQueueAttributes on $MAIN_URL)"
