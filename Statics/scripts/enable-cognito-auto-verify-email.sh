#!/usr/bin/env bash
# Enable email auto-verification on the Statics Cognito User Pool so sign-up and resend
# verification code work. Fixes: "Cannot resend codes. Auto verification not turned on"
# Requires: AWS CLI configured. Run from repo root: ./scripts/enable-cognito-auto-verify-email.sh

set -e
USER_POOL_ID="${NEXT_PUBLIC_COGNITO_USER_POOL_ID:-us-east-1_slQDFliti}"
REGION="${NEXT_PUBLIC_COGNITO_REGION:-us-east-1}"

echo "Enabling email auto-verification on pool $USER_POOL_ID in $REGION ..."

aws cognito-idp update-user-pool \
  --user-pool-id "$USER_POOL_ID" \
  --region "$REGION" \
  --auto-verified-attributes email

echo "Done. Sign-up and resend verification code should work now."
