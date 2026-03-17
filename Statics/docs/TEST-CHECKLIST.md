# Test checklist – discussed functionality

Use this to confirm everything is implemented and test end-to-end.

---

## Statics (Next.js app)

### Auth & profile

- [ ] **Sign up** → redirect to confirm-email with email in URL.
- [ ] **Confirm email**: Enter 6-digit code + password → **logged in and redirected to /dashboard** (no "Email confirmed. You can sign in now" then manual login).
- [ ] **Profile – phone**: Add phone, save → request verification code. SMS received says **"Statics verification code: XXXXXX. Valid for 10 minutes."** (not "Twilly").
- [ ] **Profile – verify**: Enter 6-digit code → success message **"Phone verified. Go to the Dashboard to browse and subscribe to apps."** and a **"Go to Dashboard"** button.
- [ ] **Dashboard**: After phone is verified, open Dashboard → **no** "Add and verify your phone number in Profile before you can subscribe" banner. Before verifying, banner should show.

### Subscriptions & March Madness

- [ ] **Subscribe** to Daily March Madness Picks (dashboard) → one immediate SMS: *"You're subscribed to Daily March Madness Picks. You'll get daily picks via SMS. Reply STOP to opt out."*
- [ ] **Allowed numbers**: Statics returns only subscribers with **phone verified** and **smsStatus === "active"**. Opted-out users are excluded (reply STOP, then run March Madness again – that number should not receive).

### Deploy

- [ ] Deploy Statics: from **parent of Statics** (e.g. Desktop), run **`./Statics/scripts/deploy-to-github-repos.sh`**. Pushes to `dehyubuilds/statics` (not the parent repo).

---

## March Madness V1 backend

### Infra

- [ ] **Tables**: Run `./scripts/deploy_infra.sh` so these exist: `march_madness_daily_picks`, `march_madness_predictions_log`, **`march_madness_welcome_sent`**.
- [ ] **Lambda**: Run `./scripts/deploy_backend.sh` (env: CBB API, STATICS_BASE_URL, Twilio, table names, **WELCOME_SENT_TABLE**).
- [ ] **Schedule** (optional): `./scripts/create_schedule.sh` → daily 8 AM UTC.

### Daily workflow

- [ ] **Run daily picks** (admin UI or `POST /run-daily-picks`):
  - Loads today’s games from CBB API.
  - Builds features (spread/total/prop), ranks, builds SMS.
  - For each allowed number (from Statics): if **first time** (not in `march_madness_welcome_sent`), sends **welcome** SMS (games today vs no games + what to expect), then marks phone in table.
  - Sends **daily picks** SMS to all allowed numbers (or "No games today").
- [ ] **New subscriber**: First run after they subscribe → they get **welcome** then **picks** (or "No games today"). Next runs → only picks.
- [ ] **Picks message**: "March Madness Picks" + up to 3 picks with **Why:** line (from `features.py`: efficiency/turnover, pace/line, or 3PA/line), truncated to 70 chars.

### Analysis / Why

- [ ] **Why logic**: In-app only. `backend/services/features.py` – `score_spread_edge`, `score_total_edge`, `score_prop_edge` return `(score, explanation)`. Same numbers used in the formula are in the explanation string. See `backend/ANALYSIS-AND-WHY.md`.

---

## Quick commands

```bash
# Deploy Statics to GitHub (from parent of Statics)
./Statics/scripts/deploy-to-github-repos.sh

# List March Madness subscribers (from Statics root)
node scripts/list-statics-subscribers.mjs

# March Madness: create tables (from march-madness-v1)
./scripts/deploy_infra.sh
```

All discussed functionality is implemented; use this checklist to verify in your environment.
