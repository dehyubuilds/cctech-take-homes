#!/usr/bin/env bash
# Enable USER_PASSWORD_AUTH on the Statics Cognito app client so server-side sign-in works.
# Uses pool/client from config (StaticsAuth: us-east-1_slQDFliti / 4pp9aeol19sug0i4rk8fvddcq1).
# Requires: AWS CLI configured with credentials that can update the user pool client.
# Run from repo root: ./scripts/enable-cognito-password-auth.sh

set -e
USER_POOL_ID="${NEXT_PUBLIC_COGNITO_USER_POOL_ID:-us-east-1_slQDFliti}"
CLIENT_ID="${NEXT_PUBLIC_COGNITO_CLIENT_ID:-4pp9aeol19sug0i4rk8fvddcq1}"
REGION="${NEXT_PUBLIC_COGNITO_REGION:-us-east-1}"

echo "Enabling ALLOW_USER_PASSWORD_AUTH on client $CLIENT_ID (pool $USER_POOL_ID) in $REGION ..."
aws cognito-idp update-user-pool-client \
  --user-pool-id "$USER_POOL_ID" \
  --client-id "$CLIENT_ID" \
  --region "$REGION" \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH

echo "Done. Sign-in with email/password should work on deploy."
