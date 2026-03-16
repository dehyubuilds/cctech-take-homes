# Netlify environment variables for Statics

Set these in **Netlify** → your site → **Site configuration** → **Environment variables**.  
Use **Sensitive** for any value that must be secret. After adding or changing variables, trigger **Deploy site** (or **Clear cache and deploy**).

---

## Required for sign-in / sign-up (Cognito)

**Netlify reserves `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`.** Use these names instead:

| Variable | Value | Notes |
|----------|--------|------|
| `STATICS_AWS_ACCESS_KEY_ID` | Your IAM access key ID | IAM user in same account as Cognito pool; needs `cognito-idp:*` (or at least `InitiateAuth`, `SignUp`, `ConfirmSignUp`, `ResendConfirmationCode`, `AdminGetUser`). Create in IAM → Users → Security credentials → Create access key. |
| `STATICS_AWS_SECRET_ACCESS_KEY` | Your IAM secret access key | Shown once when you create the key. |
| `STATICS_AWS_REGION` | `us-east-1` | Region where your Cognito user pool and DynamoDB tables live. |
| `NEXT_PUBLIC_COGNITO_REGION` | `us-east-1` | Same as Cognito user pool region. |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Your Cognito User Pool ID | e.g. `us-east-1_XXXXXXXX`. From AWS Console → Cognito → User pools → your pool (StaticsAuth). |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Your Cognito App client ID | From the same pool → App integration → App client. Enable **USER_PASSWORD_AUTH** on the client. |

---

## Required for production data (DynamoDB)

| Variable | Value | Notes |
|----------|--------|------|
| `STATICS_USERS_TABLE` | `statics_users` | DynamoDB table name for users. |
| `STATICS_APPS_TABLE` | `statics_apps` | DynamoDB table for apps. |
| `STATICS_SUBSCRIPTIONS_TABLE` | `statics_subscriptions` | DynamoDB table for subscriptions. |
| `STATICS_SUBSCRIPTION_STOP_TABLE` | `statics_subscription_stop` | DynamoDB table for subscription stop. |

---

## Required for profile avatars (S3)

| Variable | Value | Notes |
|----------|--------|------|
| `AWS_S3_AVATAR_BUCKET` | Your S3 bucket name | e.g. `statics-avatars-ACCOUNT_ID`. IAM user needs `s3:PutObject`, `s3:GetObject` on this bucket. |
| `NEXT_PUBLIC_AVATAR_BASE_URL` | Base URL for avatar images | e.g. `https://statics-avatars-ACCOUNT_ID.s3.us-east-1.amazonaws.com` or your CloudFront URL. No trailing slash. |

---

## App URL (production)

| Variable | Value | Notes |
|----------|--------|------|
| `NEXT_PUBLIC_APP_URL` | Your site URL | e.g. `https://animated-meerkat-c9b887.netlify.app`. No trailing slash. |

---

## Optional

| Variable | Value | Notes |
|----------|--------|------|
| `STATICS_VERIFY_TABLE` | DynamoDB table for 2FA codes | e.g. `statics_verify`. Only needed if using phone 2FA across multiple instances. |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | For SMS. From Twilio Console. |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | For SMS. From Twilio Console. |
| `TWILIO_PHONE_NUMBER` | Twilio phone number | e.g. `+1234567890`. |
| `TWILIO_VERIFY_SERVICE_ID` | Twilio Verify Service SID | Optional; for Verify API instead of raw SMS. |
| `NEXT_PUBLIC_FB_APP_ID` | Facebook App ID | Only if using Facebook login. |
| `STATICS_ADMIN_EMAIL` | Admin email | Overrides default admin email. |
| `STATICS_MARCH_MADNESS_API_KEY` | API key for March Madness allowed-numbers | If you use that endpoint. |

---

## Example (required only)

Minimal set so sign-in and core app work. **On Netlify use `STATICS_AWS_*` (reserved names `AWS_*` are not allowed):**

```
STATICS_AWS_ACCESS_KEY_ID=<your IAM access key>
STATICS_AWS_SECRET_ACCESS_KEY=<your IAM secret key>
STATICS_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=<your app client id>
STATICS_USERS_TABLE=statics_users
STATICS_APPS_TABLE=statics_apps
STATICS_SUBSCRIPTIONS_TABLE=statics_subscriptions
STATICS_SUBSCRIPTION_STOP_TABLE=statics_subscription_stop
AWS_S3_AVATAR_BUCKET=statics-avatars-XXXXXXXX
NEXT_PUBLIC_AVATAR_BASE_URL=https://statics-avatars-XXXXXXXX.s3.us-east-1.amazonaws.com
NEXT_PUBLIC_APP_URL=https://your-site.netlify.app
```

Replace placeholders with your real values. Do not commit this file with real secrets.
