#!/usr/bin/env bash
# Configure Cognito User Pool to send verification email via Amazon SES with
# Statics-branded subject and body. Does everything programmatically:
# 1) Find a verified SES identity in the same region (or use the one you pass).
# 2) Set the pool to use SES (DEVELOPER) and set the verification message template.
#
# Usage:
#   ./scripts/configure-cognito-ses-statics-email.sh              # use first verified SES identity
#   ./scripts/configure-cognito-ses-statics-email.sh noreply@example.com   # use this identity
#
# Prereqs: At least one verified email or domain in SES in the same region as the pool.
# Run from repo root.

set -e
USER_POOL_ID="${NEXT_PUBLIC_COGNITO_USER_POOL_ID:-us-east-1_slQDFliti}"
REGION="${NEXT_PUBLIC_COGNITO_REGION:-us-east-1}"
SES_IDENTITY="${1:-}"

if [ -z "$SES_IDENTITY" ]; then
  echo "No SES identity given. Listing verified identities in $REGION ..."
  IDENTITIES=$(aws ses list-identities --region "$REGION" --output text --query 'Identities[]')
  FOUND=""
  for id in $IDENTITIES; do
    STATUS=$(aws ses get-identity-verification-attributes --identities "$id" --region "$REGION" \
      --query "VerificationAttributes.\"$id\".VerificationStatus" --output text 2>/dev/null || echo "None")
    if [ "$STATUS" = "Success" ]; then
      FOUND="$id"
      break
    fi
  done
  if [ -z "$FOUND" ]; then
    echo "No verified SES identity found in $REGION. Verify an email or domain in SES first:"
    echo "  https://console.aws.amazon.com/ses/home?region=$REGION#/verified-identities"
    echo "Then run: $0 your-verified-email@example.com"
    exit 1
  fi
  SES_IDENTITY="$FOUND"
  echo "Using verified identity: $SES_IDENTITY"
fi

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
SOURCE_ARN="arn:aws:ses:${REGION}:${ACCOUNT}:identity/${SES_IDENTITY}"

echo "Configuring pool $USER_POOL_ID to use SES ($SES_IDENTITY) and Statics verification template ..."

aws cognito-idp update-user-pool \
  --user-pool-id "$USER_POOL_ID" \
  --region "$REGION" \
  --email-configuration "EmailSendingAccount=DEVELOPER,SourceArn=$SOURCE_ARN,From=$SES_IDENTITY" \
  --verification-message-template '{
    "DefaultEmailOption": "CONFIRM_WITH_CODE",
    "EmailSubject": "Your Statics verification code",
    "EmailMessage": "Your Statics verification code is {####}. Enter it in the app to confirm your email."
  }'

echo "Done. Verification emails will be sent from $SES_IDENTITY with Statics subject and message."
