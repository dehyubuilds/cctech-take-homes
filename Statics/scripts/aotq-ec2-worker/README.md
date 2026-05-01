# Art of the Question — EC2 Whisper worker

FastAPI service that Statics calls when `config.artOfTheQuestion.transcriptBackend` is `ec2_whisper`. It downloads audio with **yt-dlp**, transcribes with **faster-whisper**, optionally summarizes with **Amazon Bedrock**, then writes the same **DynamoDB** item shape and **S3** transcript JSON as the Next.js ingest path.

## Contract (matches Statics)

- **Endpoint:** `POST /ingest` → **202 Accepted** (job runs in background).
- **Dropflow / Private Collection YouTube → S3:** `POST /youtube-import` → **202 Accepted** (same JSON payload as the `statics-youtube-import` Lambda async invoke). Auth: same Bearer as `/ingest`. Configure `config.youtubeImport.workerApiBaseUrl` + `workerApiSharedSecret`; leave `config.youtubeImport.lambdaName` empty to avoid Lambda.
- **Auth:** `Authorization: Bearer <same value as config.artOfTheQuestion.workerApiSharedSecret>`.
- **JSON body:** `projectId`, `sourceId`, `userId`, `youtubeUrl`, `videoId`, `tableName` (e.g. `statics_aotq`), optional `runLlmAfterTranscribe` (boolean).
- **Dynamo keys:** `pk = VIDEO_PROJECT#{projectId}`, `sk = SOURCE#{sourceId}`, `entity = video_project_source`.
- **S3 key:** `aotq/{userId}/{projectId}/{sourceId}/transcript.json` (same bucket as Statics `artOfTheQuestion.mediaBucket`).

## EC2 host setup

1. **Instance:** GPU optional; `faster-whisper` uses CUDA when available (`WHISPER_DEVICE=auto`). For CPU-only, use a larger instance and a smaller model (e.g. `base`).
2. **Elastic IP:** Associate an EIP so `workerApiBaseUrl` in Statics stays stable across stop/start.
3. **System packages** (Ubuntu example):

   ```bash
   sudo apt update
   sudo apt install -y ffmpeg python3.12-venv python3-pip git
   # yt-dlp (ensure on PATH)
   sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
   sudo chmod a+rx /usr/local/bin/yt-dlp
   ```

4. **App directory:**

   ```bash
   sudo mkdir -p /opt/aotq-ec2-worker
   sudo rsync -a ./ /opt/aotq-ec2-worker/   # from repo scripts/aotq-ec2-worker
   cd /opt/aotq-ec2-worker
   python3.12 -m venv .venv
   . .venv/bin/activate
   pip install -U pip
   # GPU: install torch with CUDA from pytorch.org first, then:
   pip install -r requirements.txt
   ```

5. **Environment:** copy `.env.example` to `/opt/aotq-ec2-worker/.env` and set at least `AOTQ_WORKER_BEARER_TOKEN` (must match Statics `workerApiSharedSecret`), `AWS_REGION`, `AOTQ_MEDIA_BUCKET`.

6. **TLS + reverse proxy:** Terminate HTTPS on **nginx** or **Caddy** and proxy to `127.0.0.1:8787`. Point Statics `workerApiBaseUrl` at `https://your-eip-or-dns` (no trailing slash).

7. **systemd:** see `systemd/aotq-worker.service.example`.

## IAM (prefer instance role)

Attach a role to the EC2 instance with:

- **DynamoDB:** `GetItem`, `PutItem` on table `arn:aws:dynamodb:REGION:ACCOUNT:table/statics_aotq` (scoped to that table).
- **S3:** `PutObject`, `GetObject` on `arn:aws:s3:::statics-dropflow-142770202579/aotq/*` (or your media bucket + prefix).
- **Bedrock (optional LLM):** `bedrock:InvokeModel` on the inference profile / model you set in `AOTQ_BEDROCK_MODEL_ID`.

Avoid long-lived access keys on the instance when a role is enough.

## Health check

`GET /health` → `{ "status": "ok" }` for load balancers.

## Local smoke test

```bash
cd scripts/aotq-ec2-worker
export PYTHONPATH="$(pwd)"
export AOTQ_WORKER_BEARER_TOKEN=testsecret
export AWS_REGION=us-east-1
export AOTQ_MEDIA_BUCKET=your-bucket
# Optional: export AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY for dev
pip install -r requirements.txt
./run.sh
```

Then:

```bash
curl -sS -D - -X POST http://127.0.0.1:8787/ingest \
  -H "Authorization: Bearer testsecret" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"vp_test","sourceId":"uuid-here","userId":"user","youtubeUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","videoId":"dQw4w9WgXcQ","tableName":"statics_aotq","runLlmAfterTranscribe":false}'
```

Use a real `sourceId` / `projectId` that already exist in Dynamo (created by the Statics UI) so the worker can merge-update the row.

## IAM (created via AWS CLI in this repo)

Account **142770202579** — resources you can attach to your GPU/CPU worker instance:

| Resource | ARN / name |
|----------|----------------|
| Managed policy | `arn:aws:iam::142770202579:policy/AotqEc2Worker` |
| EC2 trust role | `arn:aws:iam::142770202579:role/AotqEc2WorkerRole` |
| Instance profile | `arn:aws:iam::142770202579:instance-profile/AotqEc2WorkerProfile` |

**Attach to an existing EC2 instance** (replace `i-xxxxxxxx`):

```bash
aws ec2 associate-iam-instance-profile \
  --instance-id i-xxxxxxxx \
  --iam-instance-profile Name=AotqEc2WorkerProfile
```

If the instance already has a profile, use `replace-iam-instance-profile-association` instead.

**Re-render policy JSON** after changing region or bucket:

```bash
export AWS_REGION=us-east-1
export AOTQ_MEDIA_BUCKET=statics-dropflow-142770202579
./deploy/render-iam-policy.sh | tee /tmp/aotq-worker-policy.json
aws iam create-policy-version \
  --policy-arn arn:aws:iam::142770202579:policy/AotqEc2Worker \
  --policy-document file:///tmp/aotq-worker-policy.json \
  --set-as-default
```

Policy source: `deploy/ec2-worker-iam-policy-document.json` (placeholders `AWS_REGION`, `AWS_ACCOUNT_ID`, `AOTQ_MEDIA_BUCKET`).

From the **Statics repo root**, run **`npm run verify:aotq-local`** — it checks Node, `yt-dlp`, `ffmpeg`, AWS session, and the worker `.venv`.

## Test with Statics running on your laptop

### Option A — Whisper on this machine (full stack local)

1. **Worker terminal** — from `scripts/aotq-ec2-worker`:

   ```bash
   export AOTQ_WORKER_BEARER_TOKEN=local-dev-secret
   export AWS_REGION=us-east-1
   export AOTQ_MEDIA_BUCKET=statics-dropflow-142770202579
   ./run.sh
   ```

   After cloning or updating deps, run **`.venv/bin/pip install -r requirements.txt`** so **`yt-dlp`** is inside this venv (ingest uses `python -m yt_dlp` from the same interpreter). Install **`ffmpeg`** on PATH for audio muxing.

2. **Statics terminal** — repo root, create **`.env.local`** (gitignored):

   ```bash
   AOTQ_TRANSCRIPT_BACKEND=ec2_whisper
   AOTQ_WORKER_API_BASE_URL=http://127.0.0.1:8787
   AOTQ_WORKER_API_SECRET=local-dev-secret
   ```

3. **`npm run dev`**, sign in, open **Art of the Question → project → Add YouTube**.  
   The API will POST to your local worker; the worker uses your **AWS credentials** (`~/.aws` or env) to read/write **real** `statics_aotq` + S3 — use a throwaway project or expect real data.

### Option B — Local Next.js only; ingest + Whisper on EC2 (nothing heavy on your Mac)

Point **`.env.local`** at the **Elastic IP / DNS** of the running worker (same secret as `AOTQ_WORKER_BEARER_TOKEN` on the instance), not loopback:

```bash
AOTQ_TRANSCRIPT_BACKEND=ec2_whisper
AOTQ_WORKER_API_BASE_URL=http://YOUR_ELASTIC_IP:8787
AOTQ_WORKER_API_SECRET=same_as_production_worker_token
```

Start the EC2 instance and ensure security group allows **your IP** (or `0.0.0.0/0` for testing) to **TCP 8787**. Optional: `AOTQ_FORCE_EC2_INSTANCE_CONTROLS=1` so the project page shows Start/Stop while you browse the app on `localhost`.

To stay on **captions-only** locally, remove the `ec2_whisper` lines from `.env.local` (default stays `youtube_captions` from `config.ts` unless overridden).

## Local venv (CLI)

```bash
cd scripts/aotq-ec2-worker
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
PYTHONPATH=. ./.venv/bin/python -c "from app.main import app; print(app.title)"
./run.sh
```

Use `.venv/bin/python` (not bare `python`) so imports resolve to the venv.

## Statics config checklist

- `artOfTheQuestion.transcriptBackend`: `"ec2_whisper"`.
- `artOfTheQuestion.workerApiBaseUrl`: `https://…` (EIP/DNS).
- `artOfTheQuestion.workerApiSharedSecret`: same string as `AOTQ_WORKER_BEARER_TOKEN` here.
- `artOfTheQuestion.workerInstanceId` + region: for Start/Stop in the UI.
- `artOfTheQuestion.mediaBucket`: same as `AOTQ_MEDIA_BUCKET`.

Start the EC2 instance before adding sources if the worker must be reachable from Netlify.
