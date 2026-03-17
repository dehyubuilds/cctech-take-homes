# Statics + March Madness: Who Gets Texts & Full Technical Capability

Use this doc for AI-assisted marketing and to understand exactly who receives messages and what the system can do.

---

## Who gets a text tomorrow at 8 AM UTC?

**Based on subscribed users:** The daily run (8:00 AM UTC) sends SMS only to **allowed numbers** returned by Statics. A user gets a text if and only if:

1. **Subscribed** – They have an **active subscription** to the app **Daily March Madness Picks** in Statics (they clicked Subscribe on the Dashboard).
2. **Verified phone** – They added and **verified** their phone number in Statics Profile (required to subscribe).
3. **SMS active** – Their **smsStatus** is **"active"**. Users who replied **STOP** to any message have `smsStatus === "opted_out"` and are **excluded** from the list.

**Technical flow:** March Madness Lambda calls `GET /api/products/march-madness/allowed-numbers` on Statics. Statics looks up the app by slug `daily-march-madness-picks`, loads all subscriptions for that app, then for each subscriber loads the user and adds their phone (E.164) only if `user.smsStatus === "active"` and `user.phoneNumber` is set. So the list = **subscribed + verified phone + not opted out**.

**First-time on the list:** If a number appears in the allowed list for the **first time** on a given run, they receive (1) a **welcome** SMS (games today / no games today + what to expect), then (2) the **daily picks** SMS (or "No games today"). Returning subscribers get only the daily picks SMS.

---

## Full technical capability (Statics + March Madness) — for marketing / AI

### Statics (Next.js app)

**What it is:** A members-only web app where users sign up, verify their phone, browse curated “apps” (products), and subscribe to receive SMS from those products. No app download; everything is web + SMS.

**Auth & identity**
- Sign up with email + password (Cognito).
- Email verification (confirmation code).
- Sign in / sign out; session in browser (token in localStorage).
- Password reset (forgot password flow).

**Profile**
- Email (from Cognito).
- Phone number (required for subscribing to any product).
- Phone verification: 6-digit code via SMS (Twilio Verify API); must verify before subscribing.
- Avatar upload (optional; S3 presigned URL).
- SMS status: **active** or **opted_out**. Inbound SMS **STOP** / **START** / **HELP** hit Twilio webhook → Statics updates `smsStatus` and stores it; opted-out users are excluded from product recipient lists.

**Apps & subscriptions**
- **Apps** are products (e.g. “Daily March Madness Picks”) stored in DynamoDB; each has name, slug, description, appId.
- **Dashboard**: User sees a list of apps; can **Subscribe** or **Unsubscribe** per app. Subscribe is gated on verified phone.
- **Subscription record** per user per app (subscriptionId, userId, appId, status: active, deliveryChannel: sms, createdAt, updatedAt).
- On **Subscribe**: Statics sends one **welcome SMS** immediately: “Statics: You're subscribed to [App Name]. What to expect: one text per day with picks and analysis (spread/total, matchups, start times, short reasons). Your first message will be sent on the next run. Reply STOP to opt out.”

**Product API (for backends like March Madness)**
- **Allowed numbers**: `GET /api/products/march-madness/allowed-numbers` returns E.164 phone numbers for users who (1) are subscribed to Daily March Madness Picks, (2) have `smsStatus === "active"`, (3) have a phone number. Used by March Madness to know who to text each day.

**Admin**
- Admin area (email-gated) to create/edit apps and view subscriber counts.
- No public app store; apps are curated and shown on the Dashboard to logged-in users.

**Tech stack**
- Next.js 14 (App Router + Pages API), React, TypeScript.
- AWS: Cognito (auth), DynamoDB (users, apps, subscriptions, verify), S3 (avatars).
- Twilio: Verify (phone verification), Messaging (SMS), webhook for STOP/START/HELP.
- Deployed on Netlify; config hardcoded (no env for credentials in current setup).

---

### March Madness V1 (Python Lambda + Statics)

**What it is:** A daily SMS product that sends one message per day with college basketball picks (spread, total, prop) and short “why” explanations. It uses Statics for identity and recipient list; it does not have its own user database.

**Schedule**
- **8:00 AM UTC daily** when EventBridge rule is configured (`cron(0 8 * * ? *)`).
- Can also be triggered manually: “Run daily picks” in admin UI or `POST /run-daily-picks` to the Lambda API.

**Data flow**
1. **Games** – College Basketball Data API: today’s games (GET /games with date).
2. **Stats** – Team season stats (efficiency, pace, turnover %, etc.) and player season stats (e.g. 3PA, 3P%) per game.
3. **Features** – Deterministic scoring of spread/total/prop edges from stats.
4. **Ranking** – Top 3 edges by absolute score; no randomness.
5. **Message** – Single SMS body: “March Madness Picks” + up to 3 picks, each with type (Spread/Total/Prop), selection, game, start time (ET), and “Why:” (short reason, ~70 chars).
6. **Recipients** – Statics `GET /api/products/march-madness/allowed-numbers` (subscribed, verified, smsStatus active).
7. **Send** – For each allowed number: if first time in list → send **welcome** SMS (games today vs no games + what to expect), then send **daily picks** SMS (or “No games today”). Otherwise send only daily picks.
8. **Store** – Picks and message stored in DynamoDB (`march_madness_daily_picks`); optional per-pick log in `march_madness_predictions_log`.

**Message types**
- **Welcome (first time only):** “Welcome to March Madness Picks! Today there are N game(s). We'll text you daily with: top spread & total picks, game matchups, start times (ET), and short reasons. One message per day. Reply STOP to opt out.” (Or “No games today” variant.)
- **Daily picks:** Header “March Madness Picks”, then numbered picks with [Spread/Total/Prop], selection, game, time, “Why: …”. Or “No games today” when slate is empty.

**Tech stack**
- Python Lambda (API Gateway HTTP API).
- College Basketball Data API (games, team/player season stats).
- DynamoDB: daily_picks, predictions_log, welcome_sent (per-phone “welcome already sent”).
- Twilio: same account as Statics for sending SMS.
- Statics: source of allowed phone numbers; no direct user DB in March Madness.

**Scale**
- One message body per run; same content to all recipients. Sending is a loop over allowed numbers in one Lambda invocation. Suitable for hundreds to low thousands of subscribers; not designed for millions without a queue + fan-out.

---

## One-line summaries for marketing

- **Statics:** “Sign up on web, verify your phone, subscribe to curated SMS products. One place for identity, phone, and opt-out; products like March Madness use it to know who to text.”
- **March Madness:** “Daily SMS with top college basketball picks (spread, total, prop), game matchups, start times, and short reasons. One text per day at 8 AM UTC; new subscribers get a welcome then picks. Opt out anytime by replying STOP.”
