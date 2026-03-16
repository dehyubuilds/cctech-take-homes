# Cognito email verification – not receiving code

If users don't see the verification email or "Resend code" fails, check the following.

## 1. Check the actual error

After the latest app update, "Resend code" shows specific errors when possible:

- **"This account is already confirmed. Try signing in."** → Go to the login page and sign in.
- **"We couldn't send the verification email. Check your email address and spam folder…"** → Cognito couldn't deliver (see below).
- **"Too many attempts…"** → Wait a few minutes and try again.
- **"No account found for this email."** → Sign up again from the sign-up page.
- **"Resend is not available for this account…"** or **"Cannot resend codes. Auto verification not turned on"** → The User Pool does not have auto-verification enabled for email. See **§5** below.

Check **Netlify → Logs** (or server logs) for `[Statics Auth] cognito resendCode` to see the raw Cognito error name and message.

## 2. Email not arriving (first sign-up or resend)

- **Spam/junk**  
  Cognito’s default sender often lands in spam. Ask users to check spam and add the sender to contacts.

- **Cognito default email**  
  Pools created with the script use Cognito’s built-in email (no SES). It works but is more likely to be filtered.

- **Switched to SES and codes stopped arriving**  
  If you ran `configure-cognito-ses-statics-email.sh` and verification emails no longer arrive, the account is likely in **SES sandbox**: SES only delivers to **verified recipient** addresses. Revert to the default sender so any address can receive codes:
  ```bash
  ./scripts/revert-cognito-email-to-default.sh
  ```
  To use SES with custom “Statics” messaging, either request [SES production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html) or verify each test recipient in SES (Verified identities → Create identity → Email address).

- **Use Amazon SES for better delivery**  
  1. In **AWS Console → Cognito → User Pools → your pool → Messaging**:
     - Set **Email** to “Send email with Amazon SES”.
     - Choose an SES identity (domain or address) in the same region.
  2. If SES is in **sandbox**, verify the recipient address in SES (or move out of sandbox) or verification emails may not be sent.
  3. Ensure the IAM role used by Cognito for SES has `ses:SendEmail` (and optionally `ses:SendRawEmail`) on that identity.

## 3. Resend fails with CodeDeliveryFailureException

This means Cognito tried to send the email but delivery failed. Common causes:

- SES not configured or in sandbox with unverified recipient.
- Invalid or typo’d email at sign-up.
- SES sending limits or bounces.

Fix: Configure SES as above, verify the recipient (in sandbox), and/or check SES sending quotas and bounce/complaint lists.

## 4. User already confirmed

If the user already confirmed earlier, **ResendConfirmationCode** returns an error. The app now shows: “This account is already confirmed. Try signing in.” Direct them to the login page.

## 5. "Auto verification not turned on" / Resend not available

If Cognito returns **"Cannot resend codes. Auto verification not turned on"**, the User Pool is not configured to send or resend verification codes for email.

**Fix via AWS CLI (recommended):**

```bash
# From Statics repo root (uses pool id from config)
./scripts/enable-cognito-auto-verify-email.sh
```

Or one-liner (set USER_POOL_ID and REGION if needed):

```bash
aws cognito-idp update-user-pool --user-pool-id us-east-1_slQDFliti --region us-east-1 --auto-verified-attributes email
```

**Fix in AWS Console:**

1. Open **Amazon Cognito → User pools** → select your pool (e.g. `statics-user-pool`).
2. Go to **Sign-up experience** (or **User attribute configuration**).
3. Under **Attribute verification and user account confirmation**, ensure:
   - **Allow Cognito to automatically send messages to verify the following attributes** is enabled.
   - **Email** is selected as an attribute to verify.
4. Save changes.

If the pool was created without `--auto-verified-attributes email`, or this was later disabled, ResendConfirmationCode will fail with this error. After enabling email auto-verification, new sign-ups will receive codes and resend will work.

## 6. Customize email to say "from Statics" (subject/body)

With the **default Cognito sender** (`no-reply@verificationemail.com`), you **cannot** change the subject or body. Cognito only allows custom email content when the pool sends email via **Amazon SES** (Messaging → Send email with Amazon SES).

**To get Statics-branded verification emails (programmatic):**

Run from Statics repo root. The script picks the first **verified SES identity** in the same region and configures the pool to use SES plus the Statics subject/body:

```bash
# Use first verified SES identity in the pool's region
./scripts/configure-cognito-ses-statics-email.sh

# Or pass a specific identity (e.g. noreply@yourdomain.com)
./scripts/configure-cognito-ses-statics-email.sh noreply@yourdomain.com
```

Prereq: at least one **verified** email or domain in Amazon SES in the same region as the User Pool (e.g. us-east-1). Cognito will create the required service-linked role for SES when you switch to DEVELOPER.

**Manual alternative:** Configure SES in the Console (Cognito → your pool → **Messaging** → Send email with Amazon SES), then set only the template:

```bash
./scripts/set-cognito-verification-email-statics.sh
```

After configuration, verification and resend emails use **subject:** "Your Statics verification code" and **body:** "Your Statics verification code is {####}. Enter it in the app to confirm your email." The "from" address is the SES identity you used.
