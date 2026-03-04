#!/bin/bash
# Add GSI "ReleaseSchedule" to DynamoDB table Twilly for fast Query of scheduled drops (no Scan).
# GSI: PK=releaseStatus ('HELD'), SK=scheduledDropDate (ISO8601).
# Run once. Safe to re-run if the index already exists (will exit cleanly).

set -e

REGION="${1:-us-east-1}"
TABLE_NAME="Twilly"
INDEX_NAME="ReleaseSchedule"

echo "Adding GSI $INDEX_NAME to table $TABLE_NAME (region $REGION)..."

aws dynamodb update-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
    AttributeName=releaseStatus,AttributeType=S \
    AttributeName=scheduledDropDate,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"$INDEX_NAME\",\"KeySchema\":[{\"AttributeName\":\"releaseStatus\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"scheduledDropDate\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
  --region "$REGION" 2>/dev/null || {
  if aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" --query "Table.GlobalSecondaryIndexes[?IndexName=='$INDEX_NAME']" --output text | grep -q "$INDEX_NAME"; then
    echo "GSI $INDEX_NAME already exists. Nothing to do."
    exit 0
  fi
  echo "Failed to create GSI. Check that attributes releaseStatus/scheduledDropDate are not already in use by another index."
  exit 1
}

echo "GSI $INDEX_NAME creation started. Wait for IndexStatus to become ACTIVE (describe-table to check)."
