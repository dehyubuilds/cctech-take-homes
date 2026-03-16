# E2E test checklist — live Netlify site

Use this to verify the deployed Statics app end-to-end at **https://animated-meerkat-c9b887.netlify.app**.

## Quick API check (optional)

From repo root:

```bash
./scripts/e2e-check-live.sh
```

This hits `/api/health` and `/api/apps` and prints status. Fix any failures before manual testing.

---

## 1. Site loads

- [ ] Open **https://animated-meerkat-c9b887.netlify.app**
- [ ] Home page loads (no blank or 5xx)
- [ ] Nav shows: Sign in / Sign up (or Dashboard / Profile when logged in)

## 2. Sign up

- [ ] Go to **Sign up**
- [ ] Enter email + password (meets Cognito rules)
- [ ] Submit
- [ ] See success or “confirm your email” (if Cognito requires verification)
- [ ] If email verification: use link or code, then continue

## 3. Sign in

- [ ] Go to **Sign in**
- [ ] Enter same email + password
- [ ] Submit
- [ ] Redirect to dashboard or home; nav shows **Dashboard**, **Profile**

## 4. Profile and phone

- [ ] Go to **Profile**
- [ ] Enter phone (e.g. E.164: `+13015551234`), save
- [ ] See “Phone saved” and prompt for 6-digit code
- [ ] Receive SMS, enter code, verify
- [ ] Profile shows “Phone verified: Yes” (or equivalent)

## 5. Dashboard and subscribe

- [ ] Go to **Dashboard**
- [ ] See at least one app (e.g. March Madness if seeded)
- [ ] Click **Subscribe** on an app
- [ ] Confirm subscription appears (e.g. under Profile → subscriptions or dashboard)

## 6. Admin (if admin user)

- [ ] Go to **Admin** (link visible only for admin email in config)
- [ ] Open Apps list
- [ ] Create or edit an app; save
- [ ] Confirm app appears on dashboard for non-admin users

## 7. Sign out

- [ ] Sign out from nav or profile
- [ ] Confirm redirect to home and nav shows Sign in / Sign up again

---

## If something fails

| Symptom | Check |
|--------|--------|
| Sign up/in “User Pool or Client not found” | Cognito pool ID and client ID in `src/lib/config.ts` and `cognito-auth.ts` |
| No SMS / “Twilio error” | Twilio credentials and phone number in config; number verified in Twilio |
| Profile save/verify fails | DynamoDB tables and AWS credentials in config; `statics_verify` table if used |
| Dashboard empty / subscribe fails | `statics_apps` and `statics_subscriptions` tables; seed app via Admin or `scripts/seed-march-madness-app.mjs` |
| Build failed on Netlify | Ensure `/api/apps` has `dynamic = "force-dynamic"` and Dynamo client uses config credentials |

---

## Run quick check script

```bash
# Default: animated-meerkat-c9b887
./scripts/e2e-check-live.sh

# Custom URL
BASE_URL=https://your-site.netlify.app ./scripts/e2e-check-live.sh
```
