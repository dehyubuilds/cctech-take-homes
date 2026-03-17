# Production-ready: test live

All discussed updates are in the codebase. Use this to get to a live test.

---

## What’s in the codebase (ready for production)

### Statics (Next.js)
- Phone verification uses **custom SMS**: “Statics verification code: XXXXXX. Valid for 10 minutes.” (no Twilio Verify / “Twilly”).
- Profile calls `/api/user/profile/send-verify-code`; verify-phone uses **stored code only** (in-memory, Dynamo `statics_verify`, or user record).
- **Confirm email**: code + password → sign-in → redirect to **/dashboard** (no “sign in now” step).
- **Profile**: after verify, “Phone verified. Go to the Dashboard…” + **Go to Dashboard** button.
- **Dashboard**: “Add and verify your phone…” banner only when profile loaded and phone **not** verified.
- **Allowed-numbers**: no API key (hardcoded); returns only subscribers with verified phone and `smsStatus === "active"` (opt-out aware).
- **Config**: hardcoded (baseUrl, Cognito, Twilio, Dynamo, avatar). No Netlify env required for these flows.

### March Madness V1
- **Welcome SMS** for new subscribers (games today vs no games + what to expect); `march_madness_welcome_sent` table.
- **Daily picks**: CBB API → features → rank → SMS (with **Why** from `features.py`).
- **Infra**: `deploy_infra.sh` creates `march_madness_daily_picks`, `march_madness_predictions_log`, **`march_madness_welcome_sent`**.
- **Lambda**: `deploy_backend.sh` passes `WELCOME_SENT_TABLE` and other env vars.

---

## Steps to test live

### 1. Statics – Dynamo tables (if not already done)
From **Statics** root:
```bash
node scripts/create-dynamo-tables.mjs
```
Ensures `statics_users`, `statics_apps`, `statics_subscriptions`, `statics_subscription_stop`, **`statics_verify`** exist (phone codes work across restarts).

### 2. Deploy Statics to production
From the **parent** of the Statics folder (e.g. Desktop):
```bash
./Statics/scripts/deploy-to-github-repos.sh
```
Pushes to `dehyubuilds/statics`. Netlify builds from that repo. Wait for the deploy to finish.

### 3. March Madness – tables + Lambda
From **march-madness-v1**:
```bash
./scripts/deploy_infra.sh    # creates daily_picks, predictions_log, welcome_sent
```
Set **.env** (or export) for deploy_backend so Lambda has:
- `CBB_API_BASE_URL`, `CBB_API_KEY` (College Basketball Data API)
- **`STATICS_BASE_URL`** = your **live** Statics URL, e.g. `https://animated-meerkat-c9b887.netlify.app`
- `STATICS_API_KEY` = optional (Statics allowed-numbers currently has no key)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Table names (defaults are fine if you used deploy_infra)

Then:
```bash
./scripts/deploy_backend.sh
```
(Optional) Daily 8 AM UTC trigger:
```bash
./scripts/create_schedule.sh
```

### 4. Test on live Statics URL
- Sign up → confirm email (code + password) → should land on **dashboard**.
- Profile: add phone → get **“Statics verification code”** SMS → verify → see “Go to Dashboard” and use it.
- Dashboard: with phone verified, **no** “Add and verify your phone…” banner.
- Subscribe to Daily March Madness Picks → get the “You’re subscribed…” SMS.
- March Madness: run daily picks (admin with `?api=<Lambda invoke URL>` or `POST /run-daily-picks`) → new number gets **welcome** then **picks** (or “No games today”); existing numbers get picks only.

---

## Quick reference

| Item | Where |
|------|--------|
| Statics deploy | Parent of Statics: `./Statics/scripts/deploy-to-github-repos.sh` |
| Statics Dynamo tables | `node scripts/create-dynamo-tables.mjs` (from Statics root) |
| March Madness tables | From march-madness-v1: `./scripts/deploy_infra.sh` |
| March Madness Lambda | From march-madness-v1: `./scripts/deploy_backend.sh` (set STATICS_BASE_URL to live Statics URL) |
| Full test steps | `docs/TEST-CHECKLIST.md` |

All updates are in place; follow the steps above to test live in production.
