#!/usr/bin/env bash
# Create S3 bucket for profile avatars and allow public read for avatars/*.
# Run from Statics root. Requires AWS CLI.
set -e
REGION="${AWS_REGION:-us-east-1}"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
BUCKET="statics-avatars-${ACCOUNT}"

echo "Creating bucket: $BUCKET (region: $REGION)"
aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" 2>/dev/null || true

# Allow public read for avatars/* so profile image URLs work
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" 2>/dev/null || true

POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadAvatars",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::'"$BUCKET"'/avatars/*"
  }]
}'
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$POLICY" 2>/dev/null || true

# CORS so browser can PUT from localhost and production
CORS='{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }]
}'
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration "$CORS"

BASE_URL="https://${BUCKET}.s3.${REGION}.amazonaws.com"
echo ""
echo "Add to .env.local:"
echo "AWS_S3_AVATAR_BUCKET=$BUCKET"
echo "NEXT_PUBLIC_AVATAR_BASE_URL=$BASE_URL"
