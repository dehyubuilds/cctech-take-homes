#!/usr/bin/env bash
# Revert Cognito User Pool to default email sender (no-reply@verificationemail.com).
# Use this if verification emails stopped arriving after switching to SES — often
# because SES is in sandbox and only sends to verified recipient addresses.
# Run from repo root: ./scripts/revert-cognito-email-to-default.sh

set -e
USER_POOL_ID="${NEXT_PUBLIC_COGNITO_USER_POOL_ID:-us-east-1_slQDFliti}"
REGION="${NEXT_PUBLIC_COGNITO_REGION:-us-east-1}"

echo "Reverting pool $USER_POOL_ID to Cognito default email sender ..."
aws cognito-idp update-user-pool \
  --user-pool-id "$USER_POOL_ID" \
  --region "$REGION" \
  --email-configuration EmailSendingAccount=COGNITO_DEFAULT

echo "Done. Verification emails will be sent by Cognito (no-reply@verificationemail.com) and should arrive for any address (check spam)."
