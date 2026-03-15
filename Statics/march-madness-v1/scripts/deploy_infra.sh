#!/usr/bin/env bash
# Create DynamoDB tables. Idempotent (create-table fails if exists).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$ROOT_DIR/.env" 2>/dev/null || true
REGION="${AWS_REGION:-us-east-1}"
DAILY_TABLE="${DAILY_PICKS_TABLE:-march_madness_daily_picks}"
LOG_TABLE="${PREDICTIONS_LOG_TABLE:-march_madness_predictions_log}"

echo "Creating DynamoDB tables in $REGION..."

aws dynamodb create-table \
  --table-name "$DAILY_TABLE" \
  --attribute-definitions AttributeName=pick_date,AttributeType=S \
  --key-schema AttributeName=pick_date,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" 2>/dev/null || echo "Table $DAILY_TABLE already exists."

aws dynamodb create-table \
  --table-name "$LOG_TABLE" \
  --attribute-definitions AttributeName=prediction_id,AttributeType=S \
  --key-schema AttributeName=prediction_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" 2>/dev/null || echo "Table $LOG_TABLE already exists."

echo "Done."
