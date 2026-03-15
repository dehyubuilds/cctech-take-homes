# March Madness V1 – Daily Picks Tool

Lightweight daily March Madness picks: pull games, analyze stats, rank edges, send SMS to Statics subscribers, and show picks on a static admin site.

## Goals

- **Simple and cheap**: No ML, no complex agents. Deterministic, explainable logic.
- **Reliable**: One stats source (College Basketball Data API), one workflow, EventBridge daily trigger.
- **Practical**: Spread leans, total leans, optional player prop; concise SMS; admin site for today’s picks and manual run.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│ S3 static site  │────▶│ API Gateway      │────▶│ Lambda      │
│ (admin UI)      │     │ HTTP API         │     │ (app.py)    │
└─────────────────┘     └──────────────────┘     └──────┬──────┘
                                                        │
                    ┌───────────────────────────────────┼───────────────────────────────────┐
                    │                                   │                                   │
                    ▼                                   ▼                                   ▼
            ┌───────────────┐                   ┌───────────────┐                   ┌───────────────┐
            │ DynamoDB      │                   │ Statics       │                   │ Twilio        │
            │ daily_picks   │                   │ (allowed #s)  │                   │ SMS           │
            │ predictions_log│                  │ product=      │                   │               │
            └───────────────┘                   │ March Madness │                   └───────────────┘
                    ▲                           └───────────────┘
                    │
            ┌───────┴───────┐
            │ EventBridge   │
            │ (daily 8 UTC) │
            └───────────────┘
```

## Why This Has an Edge

- Stats pages show raw data. This tool aggregates multiple signals (efficiency, pace, 3PT, turnovers, recent form), ranks best edges, evaluates the full slate automatically, runs every day, and logs predictions for later improvement.

## Setup

### 1. Config

```bash
cp .env.example .env
# Edit .env, or run:
./scripts/setup_config.sh
```

You will be prompted for:

- **College Basketball Data API**: `CBB_API_BASE_URL`, `CBB_API_KEY`, `CBB_API_SECRET` (from [collegebasketballdata.com](https://collegebasketballdata.com))
- **Statics**: `STATICS_BASE_URL`, `STATICS_API_KEY`, `STATICS_TABLE_NAME` (default `Statics`) – used to read allowed phone numbers for product "March Madness"
- **Twilio**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- **AWS**: `AWS_REGION`, `S3_BUCKET_NAME`

### 2. Statics Table / API

Allowed numbers come from **Statics** (product = "March Madness"):

- **Option A**: Statics exposes `GET /api/products/march-madness/allowed-numbers` (or similar). Set `STATICS_BASE_URL` and `STATICS_API_KEY`. The Lambda calls this and gets a list of E.164 numbers.
- **Option B**: DynamoDB table named `Statics` (or `STATICS_TABLE_NAME`) with rows where `product = "March Madness"`. The service reads `phone_number` (or `phoneNumber`) from each row. Ensure Lambda has IAM permission to read that table.

### 3. College Basketball Data API

- Register at [collegebasketballdata.com](https://collegebasketballdata.com) and get an API key.
- Docs: [api.collegebasketballdata.com/docs](https://api.collegebasketballdata.com/docs).
- Set `CBB_API_BASE_URL`, `CBB_API_KEY`, and optionally `CBB_API_SECRET` in `.env`.

### 4. Twilio

- Create a Twilio account, get Account SID, Auth Token, and a phone number.
- Set in `.env`. No secrets in the frontend; backend uses env only.

## AWS CLI Deployment

No SAM/CDK/Terraform/CloudFormation. Scripts use **AWS CLI only**.

```bash
# 1. DynamoDB tables
./scripts/deploy_infra.sh

# 2. Lambda + API Gateway (loads .env for credentials to pass to Lambda)
./scripts/deploy_backend.sh

# 3. Static admin site to S3
./scripts/deploy_frontend.sh

# 4. Daily schedule (8 AM UTC)
./scripts/create_schedule.sh
```

After deploy, the script prints the API Gateway invoke URL. Use it in the admin site:

- Open the S3 website URL and add `?api=https://YOUR_API_ID.execute-api.REGION.amazonaws.com` to the URL, or
- Set `window.API_BASE` in the frontend (e.g. via a deploy-time replace) to that URL.

### Update Lambda code only

```bash
./scripts/update_lambda.sh
```

## Manual Triggers

- **Run daily picks**: In the admin site, click "Run daily picks". This calls `POST /run-daily-picks`, which runs the full workflow (games → stats → rank → SMS → store).
- **Send test SMS**: Enter a phone number and click "Send test SMS" (`POST /send-test`).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /allowed-numbers | Allowed phone numbers (from Statics) |
| GET | /today-picks | Today’s stored picks (from DynamoDB) |
| POST | /run-daily-picks | Run full daily workflow |
| POST | /send-test | Send one test SMS (body: `{"phone_number":"+1..."}`) |

All responses are JSON.

## DynamoDB Tables

**daily_picks**

- PK: `pick_date` (S)
- Attributes: `message`, `picks` (JSON string), `model_version`, `created_at`

**predictions_log**

- PK: `prediction_id` (S)
- Attributes: `pick_date`, `game_id`, `market_type`, `selection`, `predicted_value`, `confidence_score`, `explanation`, `features`, `created_at`

Created by `./scripts/deploy_infra.sh`.

## How Predictions Work

1. **Load slate**: `get_todays_games()` from College Basketball Data API.
2. **Features**: For each game, team and player stats; normalize and compute spread/total/prop scores (efficiency margin, turnover edge, pace, 3PT volume vs perimeter D).
3. **Rank**: Sort edges by score, take top 3.
4. **SMS**: Format as "March Madness Picks" + numbered picks + short "Why" lines.
5. **Send**: Load allowed numbers from Statics, send via Twilio, store in DynamoDB.

No ML models; logic is deterministic and explainable.

## Repository Structure

```
march-madness-v1/
├── frontend/          # Static admin (HTML/CSS/JS)
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── backend/
│   ├── app.py         # Lambda handler
│   ├── config.py
│   ├── sms.py         # Twilio
│   ├── services/
│   │   ├── cbb_data.py      # College Basketball Data API
│   │   ├── statics_source.py # Allowed numbers (Statics)
│   │   ├── features.py
│   │   ├── ranking.py
│   │   └── normalize.py
│   └── jobs/
│       └── daily_picks.py
├── scripts/
│   ├── setup_config.sh
│   ├── package_lambda.sh
│   ├── deploy_infra.sh
│   ├── deploy_backend.sh
│   ├── deploy_frontend.sh
│   ├── create_schedule.sh
│   └── update_lambda.sh
├── .env.example
└── README.md
```

## Estimated Cost

- **S3** static site: a few dollars/month.
- **Lambda**: near zero at low invocation count.
- **API Gateway**: minimal (pay per request).
- **DynamoDB**: minimal (on-demand).
- **Twilio**: depends on message volume.

Keep monthly cost low by design.
