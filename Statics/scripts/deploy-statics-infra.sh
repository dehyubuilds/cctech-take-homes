#!/usr/bin/env bash
# Create AWS infrastructure for Statics: Cognito User Pool, DynamoDB tables, S3 bucket.
# Run from repo root: ./scripts/deploy-statics-infra.sh
# Requires: AWS CLI configured (aws sts get-caller-identity works).
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

REGION="${AWS_REGION:-us-east-1}"
PREFIX="${STATICS_INFRA_PREFIX:-statics}"

USER_POOL_NAME="${PREFIX}-user-pool"
CLIENT_NAME="${PREFIX}-web"
USERS_TABLE="${PREFIX}_users"
APPS_TABLE="${PREFIX}_apps"
SUBS_TABLE="${PREFIX}_subscriptions"
STOP_TABLE="${PREFIX}_subscription_stop"
S3_BUCKET="${STATICS_AVATAR_BUCKET:-}"

echo "Region: $REGION"
echo "Prefix: $PREFIX"
echo "---"

# Cognito User Pool
echo "Creating Cognito User Pool..."
USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 --region "$REGION" --query "UserPools[?Name=='$USER_POOL_NAME'].Id" --output text 2>/dev/null || true)
if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" == "None" ]; then
  USER_POOL_ID=$(aws cognito-idp create-user-pool \
    --pool-name "$USER_POOL_NAME" \
    --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
    --auto-verified-attributes email \
    --username-attributes email \
    --region "$REGION" \
    --query UserPool.Id --output text)
  echo "Created User Pool: $USER_POOL_ID"
else
  echo "User Pool exists: $USER_POOL_ID"
fi

# App client (allow USER_PASSWORD_AUTH for server-side sign-in)
CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$USER_POOL_ID" --region "$REGION" --query "UserPoolClients[?ClientName=='$CLIENT_NAME'].ClientId" --output text 2>/dev/null || true)
if [ -z "$CLIENT_ID" ] || [ "$CLIENT_ID" == "None" ]; then
  CLIENT_ID=$(aws cognito-idp create-user-pool-client \
    --user-pool-id "$USER_POOL_ID" \
    --client-name "$CLIENT_NAME" \
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --region "$REGION" \
    --query UserPoolClient.ClientId --output text)
  echo "Created App Client: $CLIENT_ID"
else
  echo "App Client exists: $CLIENT_ID"
fi

# DynamoDB tables (via Node script for correct GSI definitions)
export AWS_REGION="$REGION"
export STATICS_INFRA_PREFIX="$PREFIX"
echo "Creating DynamoDB tables..."
node "$SCRIPT_DIR/create-dynamo-tables.mjs" || { echo "DynamoDB create failed. Run: node scripts/create-dynamo-tables.mjs"; exit 1; }

USERS_TABLE="${PREFIX}_users"
APPS_TABLE="${PREFIX}_apps"
SUBS_TABLE="${PREFIX}_subscriptions"
STOP_TABLE="${PREFIX}_subscription_stop"
VERIFY_TABLE="${PREFIX}_verify"

# S3 bucket for avatars (optional)
if [ -n "$S3_BUCKET" ]; then
  echo "Creating S3 bucket: $S3_BUCKET"
  aws s3api create-bucket --bucket "$S3_BUCKET" --region "$REGION" 2>/dev/null || true
  aws s3api put-public-access-block --bucket "$S3_BUCKET" --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false" 2>/dev/null || true
  echo "  (bucket ready; add CORS and policy as needed for uploads)"
fi

echo ""
echo "--- Statics env (add to .env.local or your deployment env) ---"
echo "NEXT_PUBLIC_COGNITO_REGION=$REGION"
echo "NEXT_PUBLIC_COGNITO_USER_POOL_ID=$USER_POOL_ID"
echo "NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID"
echo "AWS_REGION=$REGION"
echo "STATICS_USERS_TABLE=$USERS_TABLE"
echo "STATICS_APPS_TABLE=$APPS_TABLE"
echo "STATICS_SUBSCRIPTIONS_TABLE=$SUBS_TABLE"
echo "STATICS_SUBSCRIPTION_STOP_TABLE=$STOP_TABLE"
echo "STATICS_VERIFY_TABLE=$VERIFY_TABLE"
if [ -n "$S3_BUCKET" ]; then
  echo "AWS_S3_AVATAR_BUCKET=$S3_BUCKET"
  echo "NEXT_PUBLIC_AVATAR_BASE_URL=https://$S3_BUCKET.s3.$REGION.amazonaws.com"
fi
echo "---"
echo "Done. Next: set Twilio vars, then run deploy-statics-app.sh or deploy the app."
