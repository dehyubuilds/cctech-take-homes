# How to test March Madness V1 locally

## What you need set in `.env`

- **CBB_API_KEY** – already set
- **Twilio** – already set
- **AWS_REGION** – already set
- **STATICS_BASE_URL** – set to `http://localhost:3000` when Statics runs locally
- **S3_BUCKET_NAME** – only needed when you deploy the static site; leave blank for local test

Optional: **STATICS_API_KEY** only if you added auth to Statics’ allowed-numbers endpoint.

## 1. Create DynamoDB tables (one-time)

So “Run daily picks” can store today’s picks and the backend can read them:

```bash
cd march-madness-v1
./scripts/deploy_infra.sh
```

Uses your default AWS profile and `AWS_REGION` from `.env`.

## 2. Run Statics (so allowed numbers work)

In a terminal:

```bash
cd Statics   # parent of march-madness-v1
npm run dev
```

Leave it running at `http://localhost:3000`.

In **march-madness-v1/.env** set:

```bash
STATICS_BASE_URL=http://localhost:3000
```

Make sure in Statics you have at least one user who:
- Is subscribed to the “Daily March Madness Picks” app
- Has a phone number and `smsStatus` = active  

(Use Statics UI: sign up, add phone, subscribe to that app.)

## 3. Run the March Madness backend locally

In another terminal:

```bash
cd march-madness-v1
pip install -r backend/requirements.txt
python backend/server_local.py
```

You should see: `March Madness V1 local API: http://localhost:8000`.

## 4. Open the admin frontend

- Open **march-madness-v1/frontend/index.html** in your browser (File → Open, or drag the file).
- Add the API URL as a query param:  
  **file:///.../frontend/index.html?api=http://localhost:8000**

Or serve the folder with any static server, e.g.:

```bash
cd march-madness-v1/frontend
python -m http.server 9000
```

Then open: **http://localhost:9000/?api=http://localhost:8000**

## 5. What to try

- **Refresh** – loads today’s picks from DynamoDB (empty until you run daily picks).
- **Allowed phone numbers** – should list numbers from Statics (subscribed + SMS active).
- **Run daily picks** – calls CBB API, computes picks, sends SMS to allowed numbers, writes to DynamoDB. Check your phone for a test message.
- **Send test SMS** – enter your phone (e.g. +12407529966) and click to send one test message.

## If something fails

- **Allowed numbers empty** – Statics must be running, `STATICS_BASE_URL=http://localhost:3000`, and at least one subscribed user with phone + SMS active.
- **CBB API errors** – check key and rate limits (e.g. 1,000 requests/month on free tier).
- **Twilio errors** – check Account SID, Auth Token, and from number.
- **DynamoDB errors** – run `./scripts/deploy_infra.sh` and ensure AWS credentials (default profile) can access that region.
