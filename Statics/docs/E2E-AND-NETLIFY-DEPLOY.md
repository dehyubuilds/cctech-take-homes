# E2E testing with real DynamoDB and Netlify deploy

Use **real DynamoDB** (and Cognito/Twilio) for local testing, then deploy to Netlify.

---

## 1. Real DynamoDB (and tables)

### Create tables (one-time)

From repo root, with AWS CLI configured and `AWS_REGION` set:

```bash
export AWS_REGION=us-east-1
export STATICS_INFRA_PREFIX=statics   # optional; default is statics
node scripts/create-dynamo-tables.mjs
```

This creates: `statics_users`, `statics_apps`, `statics_subscriptions`, `statics_subscription_stop`, `statics_verify`. Copy the printed table names into your env.

### Local env (`.env.local`)

Copy from `.env.example` and set **at least** these so the app uses real DynamoDB and can send/verify SMS:

```env
# App (for production URL after deploy)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cognito (required for production auth)
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxx

# Twilio (required for SMS and phone verification)
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
# Optional: Twilio Verify service (VAxxxx) for 2FA; if unset, codes are stored in DynamoDB on the user record
TWILIO_VERIFY_SERVICE_ID=

# AWS + DynamoDB (required for production data)
AWS_REGION=us-east-1
STATICS_USERS_TABLE=statics_users
STATICS_APPS_TABLE=statics_apps
STATICS_SUBSCRIPTIONS_TABLE=statics_subscriptions
STATICS_SUBSCRIPTION_STOP_TABLE=statics_subscription_stop
STATICS_VERIFY_TABLE=statics_verify
```

For local runs, the AWS SDK will use your default credentials (e.g. `aws configure` or env vars `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`). No need to put those in `.env.local` if you already have a default profile.

---

## 2. E2E test flow (local)

1. **Start app**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

2. **Auth**
   - Sign up with an email (Cognito or mock).
   - Sign in.

3. **Profile and phone verification**
   - Go to **Profile**.
   - Enter phone (e.g. `301-3185581`), click **Save phone**.
   - You should get an SMS with a 6-digit code (and see “Phone saved. Check your phone for the 6-digit code…”).
   - Enter the code, click **Verify**.
   - Confirm “Phone verified: Yes” and SMS status (e.g. active).

4. **Subscribe**
   - Go to **Dashboard**, pick an app, **Subscribe**.
   - Confirm it appears under Profile → Managed products.

5. **Admin (if admin user)**
   - Go to **Admin** → create/edit an app, check subscriber counts.

If any step fails, check: Cognito app client (USER_PASSWORD_AUTH), Twilio env vars, DynamoDB table names and AWS credentials, and that the verify table exists if you rely on it (otherwise the code is stored on the user record in DynamoDB).

---

## 3. Deploy to Netlify

### Build config

The repo has a `netlify.toml`:

- Build command: `npm run build`
- Publish: handled by Netlify’s Next.js support
- Node: 18

### Netlify env vars (Site settings → Environment variables)

Set these so the deployed app uses **real DynamoDB**, Cognito, and Twilio. Do **not** commit secrets; set them in the Netlify UI.

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_APP_URL` | Yes | Your Netlify site URL, e.g. `https://your-site.netlify.app` (set after first deploy) |
| `NEXT_PUBLIC_COGNITO_REGION` | Yes | e.g. `us-east-1` |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Yes | Cognito User Pool ID |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Yes | Cognito App client ID |
| `TWILIO_ACCOUNT_SID` | Yes | For SMS / 2FA |
| `TWILIO_AUTH_TOKEN` | Yes | |
| `TWILIO_PHONE_NUMBER` | Yes | Twilio “from” number |
| `TWILIO_VERIFY_SERVICE_ID` | No | If set, 2FA uses Twilio Verify API |
| `AWS_REGION` | Yes | e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` | Yes | IAM user with DynamoDB (and optional S3) access |
| `AWS_SECRET_ACCESS_KEY` | Yes | |
| `STATICS_USERS_TABLE` | Yes | e.g. `statics_users` |
| `STATICS_APPS_TABLE` | Yes | e.g. `statics_apps` |
| `STATICS_SUBSCRIPTIONS_TABLE` | Yes | e.g. `statics_subscriptions` |
| `STATICS_SUBSCRIPTION_STOP_TABLE` | Yes | e.g. `statics_subscription_stop` |
| `STATICS_VERIFY_TABLE` | No | e.g. `statics_verify` (optional; can store code on user record) |
| `AWS_S3_AVATAR_BUCKET` | No | If using profile avatar uploads |
| `NEXT_PUBLIC_AVATAR_BASE_URL` | No | If using S3 avatars |

Use the same DynamoDB tables (and Cognito/Twilio) as in local E2E so behavior is consistent.

### Deploy steps

1. Push the Statics app to a Git repo (e.g. GitHub).
2. In Netlify: **Add new site → Import an existing project** → connect the repo.
3. Confirm build command `npm run build` and that Netlify detects Next.js.
4. Add all env vars above (including `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).
5. Deploy. After the first deploy, set `NEXT_PUBLIC_APP_URL` to the site URL and redeploy if needed.
6. In Cognito, add the Netlify URL to allowed callback/sign-out URLs if you use hosted UI or redirects.

### Post-deploy check

- Open the Netlify URL, sign in, go to Profile.
- Save phone, receive SMS, enter code, verify.
- Subscribe to an app from the dashboard.

That confirms real DynamoDB, Twilio, and Cognito work end-to-end on Netlify.
