# March Madness V1: What’s Deployed and How It Works

## Workflow frequency and schedule

- **Schedule**: The function runs **once per day at 8:00 AM UTC** when EventBridge is configured via `./scripts/create_schedule.sh`. The rule uses:
  - **`cron(0 8 * * ? *)`** → 8 AM UTC every day.
- You can also trigger manually: "Run daily picks" in the admin UI (or `POST /run-daily-picks`) runs the same workflow on demand; no schedule required for that.

---

## Same message for everyone / scale

- **Same text**: Yes. Every subscriber gets the **same** daily picks message (and new subscribers get the same welcome message). Content is computed once per run (one CBB API slate, one ranking, one message body), then that single message is sent to every allowed number.
- **Current scale**: Sending is done in a **single Lambda run** by looping over the allowed list and calling Twilio once per number. That’s fine for hundreds or low thousands of subscribers. It **does not** scale to 1M as-is: Lambda has a 15‑minute max timeout, and Twilio has rate limits (e.g. per-second caps). So with 1M subscribers you’d need a different design: e.g. **SQS** (enqueue one “send to this number” message per subscriber) and **worker Lambdas** (or a batch job) that consume the queue and call Twilio, so many senders run in parallel and respect rate limits. The *content* (one message body for all) already scales; the *delivery* would need this queue + fan-out for 1M.

---

## Sports API (College Basketball Data API) – exact categories

Base URL: `https://api.collegebasketballdata.com` (or `CBB_API_BASE_URL`).

| What we use | Endpoint | Params | Purpose |
|-------------|----------|--------|---------|
| **Today’s games** | `GET /games` | `year`, `date` (MM/DD) | Slate of games for today. Response: list of games (id, home_team_id, away_team_id, date, start_time, etc.). |
| **Team season stats** | `GET /stats/team/season` | `team` (team_id) | One object per team: offensive_efficiency, defensive_efficiency, pace, turnover_pct, three_point_pct, three_attempt_rate (or adj_off/adj_def, poss_per_40, etc. per normalize). |
| **Player season stats** | `GET /stats/player/season` | `team` (team_id) | List of players: three_point_attempts / fg3a, three_point_pct / fg3_pct for prop scoring. |
| **Recent games** (optional) | `GET /games` | `team`, `start`, `end` (YYYY-MM-DD) | Recent games for a team; used by `get_recent_games()` if needed. |

We do **not** retrieve play-by-play, box scores, or betting lines from the API; we only use games + team/player season stats to compute spread/total/prop edges.

---

## Exact text and format of messages sent

### 1. When a user subscribes (Statics, immediately)

One SMS from Statics (Twilio) when they hit “Subscribe” on the March Madness app:

```
You're subscribed to Daily March Madness Picks. You'll get daily picks via SMS. Reply STOP to opt out.
```

(If the app name in DB is different, that name is used instead of “Daily March Madness Picks”.)

### 2. First-time engagement (welcome – March Madness backend, on next daily run)

For **new** subscribers (first time they’re in the allowed list when we run daily picks), we send a **welcome** SMS first:

**If there are games today:**

```
Welcome to March Madness Picks! Today there are N game(s). We'll text you daily with: top spread & total picks, game matchups, start times (ET), and short reasons. One message per day. Reply STOP to opt out.
```

**If there are no games today:**

```
Welcome to March Madness Picks! No games today. We'll text you daily with: top spread & total picks, game matchups, start times (ET), and short reasons. One message per day when games are on. Reply STOP to opt out.
```

### 3. Daily picks message (March Madness backend)

**When there are picks (top 3 edges):**

```
March Madness Picks

1. [Spread] HomeTeam -4
   Game: HomeTeam vs AwayTeam – starts 7:00 PM ET
   Why: Efficiency margin and turnover edge (home off_eff 105.2, away to_pct 18.1)

2. [Total] HomeTeam/AwayTeam Over 141
   Game: HomeTeam vs AwayTeam – 7:00 PM ET
   Why: Pace and shot volume project above market (avg pace 68.2, line 140)

3. [Prop] Smith over 2.5 threes
   Game: HomeTeam vs AwayTeam – 7:00 PM ET
   Why: High recent 3PA volume vs weak perimeter defense (3PA 3.2, line 2.5)
```

(Explanation text is truncated to 70 chars in code; selection/game/why come from the ranking step.)

**When there are no games today:**

```
March Madness Picks

No games today.
```

---

## What’s deployed

- **Backend**: Python Lambda (`app.lambda_handler`) behind API Gateway HTTP API.
  - Deploy: from `march-madness-v1`: `./scripts/deploy_backend.sh` (uses `.env`: CBB, Statics, Twilio, Dynamo table names).
  - Local alternative: `backend/server_local.py` (Flask) for development.
- **Frontend**: Static admin site (`frontend/`) — open `index.html` with `?api=<Lambda invoke URL>` to hit the deployed API.
- **Data**: DynamoDB tables `march_madness_daily_picks` (today’s picks) and `march_madness_predictions_log` (per-pick log). Tables created by `./scripts/deploy_infra.sh`.
- **Statics**: Next.js app (separate repo/deploy) exposes **allowed phone numbers** at `GET /api/products/march-madness/allowed-numbers`. March Madness backend calls this to get the list to text.

---

## End-to-end flow

1. **Trigger**: Manual “Run daily picks” in admin, or EventBridge schedule → Lambda.
2. **Games**: Lambda calls College Basketball Data API `get_todays_games()` (today’s date).
3. **Features**: For each game (up to 10), fetches team/player stats, builds features (spread/total/prop scores).
4. **Picks**: `rank_edges()` picks top 3 edges (deterministic sort by `abs(score)`).
5. **SMS text**: `build_sms_text(picks)` → “March Madness Picks” + numbered lines (type, selection, game, time, short “Why”).
6. **Recipients**: `get_march_madness_allowed_numbers()` → GET Statics `.../allowed-numbers` (with `STATICS_API_KEY`). Statics returns only subscribers whose `smsStatus === "active"` (opt-out aware).
7. **Send**: Twilio `send_bulk_sms(numbers, message)`.
8. **Store**: Picks and message written to `march_madness_daily_picks`; per-pick rows to `march_madness_predictions_log`.

---

## Requirements vs implementation

| # | Requirement | How it’s met |
|---|-------------|--------------|
| 1 | **Retrieving today’s March Madness game data** | `services/cbb_data.py`: `get_todays_games()` calls CBB API `/games` with `year` and `date` (MM/DD). Returns list of games (home/away, ids, date, etc.). Team/player stats via `get_team_stats`, `get_player_stats`. |
| 2 | **Analyzing games in a simple, deterministic way** | `services/features.py`: `build_game_features()` normalizes game + team + player data and computes spread/total/prop scores. `services/ranking.py`: `rank_edges()` sorts all edges by `abs(score)` and returns top 3. No randomness. |
| 3 | **Generating SMS-ready picks text** | `ranking.build_sms_text(picks)`: header “March Madness Picks”, then per pick: “[Spread/Total/Prop] selection”, “Game: X vs Y – starts …”, “Why: …”. Short, SMS-friendly. |
| 4 | **Sending texts through Twilio to a list of phone numbers** | `sms.send_bulk_sms(phone_numbers, message)` loops over list and calls Twilio `client.messages.create(to=num, from_=TWILIO_PHONE_NUMBER, body=message)`. List comes from Statics (see below). |
| 5 | **Opt-out awareness (opted-out users do not receive messages)** | **Statics** `GET /api/products/march-madness/allowed-numbers`: finds app by slug `daily-march-madness-picks`, loads active subscriptions, then for each subscriber loads user and **only includes phone if `user.smsStatus === "active"`**. Users who replied STOP have `smsStatus === "opted_out"` and are excluded. March Madness backend only receives this filtered list, so it never sends to opted-out users. |

---

## Statics integration

- **Allowed numbers**: March Madness backend sets `STATICS_BASE_URL` (e.g. `https://your-statics.netlify.app`) and `STATICS_API_KEY`. It calls:
  - `GET {STATICS_BASE_URL}/api/products/march-madness/allowed-numbers`
  - Header: `Authorization: Bearer {STATICS_API_KEY}`
- **Statics side**: Set `STATICS_MARCH_MADNESS_API_KEY` (e.g. in Netlify env) to the same secret. The allowed-numbers route checks this and returns `{ numbers: string[] }` (E.164). Only subscribers to the March Madness app with **phone verified** and **smsStatus === "active"** are included.
- **Opt-out**: When a user replies STOP to a Twilio message, Statics’ Twilio webhook sets `user.smsStatus = "opted_out"`. The next time March Madness fetches allowed numbers, that user is omitted, so they get no more picks.

---

## Env vars (March Madness backend)

| Variable | Purpose |
|----------|---------|
| `CBB_API_BASE_URL`, `CBB_API_KEY` | College Basketball Data API (games + stats). |
| `STATICS_BASE_URL` | Statics app URL (e.g. Netlify). |
| `STATICS_API_KEY` | Same as Statics’ `STATICS_MARCH_MADNESS_API_KEY` (for allowed-numbers). |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Twilio SMS. |
| `DAILY_PICKS_TABLE`, `PREDICTIONS_LOG_TABLE` | DynamoDB table names. |

---

## Quick check

- **Allowed numbers**: `GET /allowed-numbers` → `{ numbers, count }` (from Statics).
- **Today’s picks**: `GET /today-picks` → from DynamoDB (empty until run-daily-picks).
- **Run flow**: `POST /run-daily-picks` → games → picks → SMS to allowed numbers → store.
