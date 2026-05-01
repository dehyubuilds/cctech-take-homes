# Local machine YouTube import (WebSocket + AWS starter)

Your browser talks to **Amazon API Gateway WebSocket**. A **Python script on your own server** polls DynamoDB for jobs, runs **yt-dlp**, uploads to the same **S3** paths Dropflow already uses, and sends **progress JSON** back over the socket so the UI can show status without relying on Lambda/EC2 IPs for YouTube.

## Architecture

1. **Next.js** `POST /api/youtube-import` (when `config.youtubeImport.localWebSocketMode` is `true`) writes a row in DynamoDB + initial S3 job JSON, returns `{ jobId, wsUrl, registerToken }`.
2. **Browser** opens `wss://…` and sends `{ "action": "register", "jobId", "registerToken" }`.
3. **WebSocket Lambda** validates the token, stores `connectionId` on the job, sets status `PENDING_WORKER`.
4. **`run_worker.py` on your machine** (AWS IAM user or role credentials) scans for `PENDING_WORKER`, then either runs **yt-dlp** for Dropflow (`jobKind: youtube_dropflow`) or **Art of the Question** (`jobKind: aotq_whisper`: `POST` to local **`/ingest`**, poll **`aotq`** Dynamo until `ready` / `error`).
5. **Browser** keeps polling existing APIs (`GET /api/youtube-import?jobId=` or AoTQ project reload) for final state; WebSocket carries live progress / errors.

## One-time AWS deploy

Prerequisites: AWS CLI, SAM CLI (`brew install aws-sam-cli`), account `142770202579` (or change template).

```bash
cd scripts/local-youtube-import-worker/sam
sam build && sam deploy --guided
```

Outputs: **WebSocketURL**, **JobsTableName**, **ManagementApiEndpoint**, **WebSocketApiId**.

## Statics configuration (no Netlify env)

Edit **`src/lib/config.ts`** (same pattern as Cognito, worker URLs, etc.):

- **`youtubeImport.localWebSocketMode`** — set `true` to use the bridge for Dropflow YouTube import.
- **`youtubeImport.localWsJobsTable`** — SAM output **JobsTableName**.
- **`youtubeImport.localWebSocketUrl`** — SAM output **WebSocketURL** (`wss://…`).
- **`artOfTheQuestion.aotqLocalWebSocketMode`** — set `true` to use the same bridge for AoTQ ingest (also requires `localWebSocketMode` and table/URL above, and `transcriptBackend: "ec2_whisper"`).

Redeploy the site after editing `config.ts`.

## Worker machine `.env`

Same **`JOBS_TABLE`** as `localWsJobsTable`, region, **`AWS_APIGW_WS_MANAGEMENT_ENDPOINT`** = **ManagementApiEndpoint** (`https://…/prod`, no `wss`), optional `YOUTUBE_COOKIES_FILE`, and IAM keys from **`worker/worker-iam-policy.json`** (replace `REGION`, `ACCOUNT_ID`, `JOBS_TABLE_NAME`, `MEDIA_BUCKET`, `WEBSOCKET_API_ID`, `AOTQ_TABLE_NAME`).

## Run the worker on your server

```bash
cd scripts/local-youtube-import-worker/worker
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in
python run_worker.py
```

Install **yt-dlp** and **ffmpeg** on the server (`PATH`).

## Security (starter)

- `registerToken` is random per job; the WebSocket Lambda compares it to the value stored on the Dynamo item. **No TTL on jobs yet** — delete rows after completion in production or add a TTL attribute.
- Prefer **WSS** only; consider locking `$connect` (e.g. signed query param) for stricter deployments.

## Art of the Question (same WebSocket + jobs table)

1. Set **`artOfTheQuestion.aotqLocalWebSocketMode`** and **`youtubeImport.localWebSocketMode`** in `config.ts`, with **`localWsJobsTable`** / **`localWebSocketUrl`** filled from SAM. `transcriptBackend` must stay **`ec2_whisper`**.
2. On the machine that runs **`run_worker.py`**, also run the **AoTQ FastAPI worker** (`scripts/aotq-ec2-worker`, `POST /ingest`) so the bridge can reach it — default `http://127.0.0.1:8787` (`AOTQ_LOCAL_WORKER_INTERNAL_URL` in worker `.env`). **`run_worker.py` auto-loads `scripts/aotq-ec2-worker/.env`** (after `worker/.env`) for missing keys, so **`AOTQ_WORKER_BEARER_TOKEN`** only needs to live next to the FastAPI app. Alternatively set **`AOTQ_WORKER_API_SECRET`** or **`AOTQ_WORKER_BEARER_TOKEN`** in **`worker/.env`** or the shell — same value as `workerApiSharedSecret` / Next **`AOTQ_WORKER_API_SECRET`**.
3. Grant the bridge IAM user **`dynamodb:GetItem` / `UpdateItem`** on the **`aotq`** table (same keys as Statics: `VIDEO_PROJECT#…` / `SOURCE#…`) in addition to the jobs table and `execute-api:ManageConnections`.
4. Adding a video in an AoTQ project returns **`wsUrl`**, **`registerToken`**, **`localWsJobId`** (or **`localWebSocketRegistrations`** for playlists); the project UI opens the socket and sends **`register`** like Dropflow import.

**Requeue** to EC2 is disabled in this mode (sources must be added again from the browser).

## Disable local-WS mode

Set **`youtubeImport.localWebSocketMode`** and **`artOfTheQuestion.aotqLocalWebSocketMode`** to **`false`** in `config.ts`, redeploy, then the normal EC2 worker / Lambda paths apply again.
