#!/usr/bin/env bash
# Set Cognito verification email subject and body to Statics branding.
# Only works after the User Pool is configured to send email via Amazon SES
# (Cognito → Messaging → Send email with Amazon SES). With default Cognito
# sender, custom subject/body are not allowed.
# Run from repo root: ./scripts/set-cognito-verification-email-statics.sh

set -e
USER_POOL_ID="${NEXT_PUBLIC_COGNITO_USER_POOL_ID:-us-east-1_slQDFliti}"
REGION="${NEXT_PUBLIC_COGNITO_REGION:-us-east-1}"

echo "Setting Statics verification email template on pool $USER_POOL_ID in $REGION ..."
echo "(Requires pool to use SES for email. See docs/COGNITO-EMAIL-VERIFICATION.md §6.)"

aws cognito-idp update-user-pool \
  --user-pool-id "$USER_POOL_ID" \
  --region "$REGION" \
  --verification-message-template '{
    "DefaultEmailOption": "CONFIRM_WITH_CODE",
    "EmailSubject": "Your Statics verification code",
    "EmailMessage": "Your Statics verification code is {####}. Enter it in the app to confirm your email."
  }'

echo "Done. Verification and resend emails will now use Statics subject and message."
