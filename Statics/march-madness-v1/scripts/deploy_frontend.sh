#!/usr/bin/env bash
# Upload static site to S3. Enable static website hosting on bucket.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$ROOT_DIR/.env" 2>/dev/null || true
BUCKET="${S3_BUCKET_NAME:?Set S3_BUCKET_NAME in .env}"
REGION="${AWS_REGION:-us-east-1}"

echo "Deploying frontend to s3://$BUCKET..."
aws s3 sync "$ROOT_DIR/frontend/" "s3://$BUCKET/" --exclude ".DS_Store" --region "$REGION"
aws s3 website "s3://$BUCKET" --index-document index.html --region "$REGION" 2>/dev/null || true
echo "Done. Website: http://$BUCKET.s3-website-$REGION.amazonaws.com/"
