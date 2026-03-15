# End-to-end deployment: Statics + March Madness

Get **everything working** in order: AWS infra → Statics app (Netlify) → March Madness backend/frontend.

## Prerequisites

- **AWS CLI** configured (`aws sts get-caller-identity` works).
- **Twilio** account: Account SID, Auth Token, Phone Number.
- **CBB API** key (for March Madness): [collegebasketballdata.com](https://collegebasketballdata.com).
- **Node.js** 18+ (for Next.js and scripts).

## 1. Statics infrastructure (one-time)

From the **Statics** repo root:

```bash
chmod +x scripts/*.sh scripts/*.mjs
./scripts/deploy-statics-infra.sh
```

This creates:

- **Cognito** User Pool + App Client (USER_PASSWORD_AUTH enabled).
- **DynamoDB** tables: `statics_users`, `statics_apps`, `statics_subscriptions`, `statics_subscription_stop`.
- Optional **S3** bucket if `STATICS_AVATAR_BUCKET` is set.

Copy the printed env block into **`.env.local`** (create if missing).

## 2. Statics app env (`.env.local`)

Add to `.env.local` (from infra output + Twilio):

```bash
# From deploy-statics-infra.sh output
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=...
NEXT_PUBLIC_COGNITO_CLIENT_ID=...
AWS_REGION=us-east-1
STATICS_USERS_TABLE=statics_users
STATICS_APPS_TABLE=statics_apps
STATICS_SUBSCRIPTIONS_TABLE=statics_subscriptions
STATICS_SUBSCRIPTION_STOP_TABLE=statics_subscription_stop

# Twilio (required for SMS)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# After first deploy, set to your Netlify site URL
NEXT_PUBLIC_APP_URL=https://your-site.netlify.app

# Shared secret for March Madness to call allowed-numbers API
STATICS_MARCH_MADNESS_API_KEY=your-secret-key
```

## 3. Deploy Statics app to Netlify

**Option A – Netlify CLI**

```bash
npm i -g netlify-cli
netlify login
netlify init   # or link to existing site
# Add all .env.local vars in Netlify Dashboard → Site settings → Environment variables
netlify deploy --prod
```

Set `NEXT_PUBLIC_APP_URL` in Netlify to your site URL (e.g. `https://your-site.netlify.app`).

**Option B – Run deploy script (uses Netlify CLI if installed)**

```bash
./scripts/deploy-statics-app.sh
```

**Option C – Git-based deploy**

1. Push the repo to GitHub/GitLab/Bitbucket.
2. In [Netlify Dashboard](https://app.netlify.com) → Add site → Import from Git → choose the Statics repo.
3. Build command: `npm run build` (default from `netlify.toml`).
4. Add the same env vars under Site settings → Environment variables.
5. Deploy. Your **Statics URL** will be `https://<site-name>.netlify.app` (or your custom domain).

## 4. Seed March Madness app (optional)

So the app appears on the dashboard without using Admin UI:

```bash
# From repo root, with .env.local loaded (or export STATICS_APPS_TABLE, AWS_REGION)
node scripts/seed-march-madness-app.mjs
```

Or create the product manually in **Statics Admin** after first login.

## 5. March Madness env (`march-madness-v1/.env`)

Copy from `march-madness-v1/.env.example` and set:

```bash
# CBB API
CBB_API_KEY=...
CBB_API_SECRET=...

# Statics (allowed numbers API)
STATICS_BASE_URL=https://your-site.netlify.app
STATICS_API_KEY=your-secret-key   # same as STATICS_MARCH_MADNESS_API_KEY

# Twilio (same or different from Statics)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# AWS
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-march-madness-admin-bucket
DAILY_PICKS_TABLE=march_madness_daily_picks
PREDICTIONS_LOG_TABLE=march_madness_predictions_log
```

## 6. March Madness infrastructure

```bash
cd march-madness-v1
./scripts/deploy_infra.sh
```

Creates DynamoDB tables for daily picks and predictions log.

## 7. March Madness backend (Lambda + API Gateway)

```bash
cd march-madness-v1
./scripts/package_lambda.sh
./scripts/deploy_backend.sh
```

Note the **Lambda/API invoke URL** from the script output.

## 8. March Madness frontend (S3 website)

```bash
cd march-madness-v1
./scripts/deploy_frontend.sh
```

Use the S3 website URL (or put CloudFront in front) for the admin UI.

---

## One-command E2E script

From **Statics** repo root:

```bash
./scripts/deploy-e2e.sh
```

This runs infra → app deploy → March Madness infra/backend/frontend in sequence. You may be prompted to create `.env.local` and `march-madness-v1/.env` if missing.

---

## What works after deploy

| Component | What works |
|----------|------------|
| **Statics** | Sign up / sign in (Cognito), dashboard, profile, subscribe/unsubscribe, admin CRUD, Twilio SMS, webhook STOP/START. |
| **March Madness** | Lambda runs daily picks, sends SMS via Twilio, allowed numbers from Statics API; admin UI shows picks and test SMS. |

First user to sign up with **admin email** (`dehyu.sinyan@gmail.com`) gets admin role and can create/disable apps and see subscribers.
