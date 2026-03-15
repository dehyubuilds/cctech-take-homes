# Deploy to two GitHub repos

- **Statics** (Next.js): https://github.com/dehyubuilds/statics  
- **March Madness** (backend + admin frontend): https://github.com/dehyubuilds/marchmadness  

## Prerequisites

1. **Create both repos on GitHub** (if they don’t exist), with at least one commit (e.g. add a README) so they’re cloneable.
2. **From the repo that contains the `Statics` folder** (e.g. your Desktop repo), run the script. The script expects:
   - `Statics/` = Next.js app (and it will **exclude** `march-madness-v1`, `.next`, `node_modules` when syncing to **statics**).
   - `Statics/march-madness-v1/` = March Madness project (synced as the **full tree** into **marchmadness**).

## Run deploy

From the **parent** of the `Statics` folder (e.g. `Desktop`):

```bash
chmod +x Statics/scripts/deploy-to-github-repos.sh
./Statics/scripts/deploy-to-github-repos.sh
```

You’ll need push access (SSH or HTTPS with credentials). The script will:

1. Clone `dehyubuilds/statics`, rsync the Next.js app (no march-madness-v1, .next, node_modules), commit and push.
2. Clone `dehyubuilds/marchmadness`, rsync `march-madness-v1/` contents, commit and push.

## March Madness: frontend vs backend

- **Backend:** All product logic (CBB API, picks, ranking, SMS, DynamoDB, Statics allowed-numbers) lives in **backend/** (Flask/Lambda).
- **Frontend:** A small **admin** UI in **frontend/**:
  - **Today’s picks** – GET /today-picks
  - **Allowed phone numbers** – GET /allowed-numbers (from Statics)
  - **Run daily picks** – POST /run-daily-picks
  - **Send test SMS** – POST /send-test with a phone number  

There is **no consumer-facing web app**; subscribers only get SMS. The frontend is for you to run daily picks and test.
