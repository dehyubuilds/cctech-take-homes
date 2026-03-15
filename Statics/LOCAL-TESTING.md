# Test locally

## Statics (Next.js) only

From the **Statics** repo root:

```bash
npm install
npm run dev
```

Open **http://localhost:3000**.

**Setup:** `.env.local` includes DynamoDB table names so subscriptions persist. AWS credentials must be configured.

- **No `.env.local`** (or missing table vars) → in-memory only; subscriptions lost on server restart.
- **With `.env.local`** (default) → DynamoDB persistence; mock auth. Subscribe once and it stays. Add Cognito/Twilio when needed.

First user with email `dehyu.sinyan@gmail.com` is admin and can use **Admin** and create products.

---

## Statics + March Madness together

1. **Start Statics** (so March Madness can call the allowed-numbers API):

   ```bash
   cd /path/to/Statics
   npm run dev
   ```
   Leave it at **http://localhost:3000**.

2. **In `march-madness-v1/.env`** set:
   ```bash
   STATICS_BASE_URL=http://localhost:3000
   STATICS_API_KEY=<same as STATICS_MARCH_MADNESS_API_KEY in Statics .env.local, or leave blank if Statics has no API key>
   ```

3. **Start March Madness backend**:

   ```bash
   cd march-madness-v1
   ./scripts/run_local.sh
   ```
   API: **http://localhost:8000**

4. **Open March Madness admin UI**  
   In a browser:
   - **http://localhost:9000/?api=http://localhost:8000** if you serve the frontend (e.g. `npx serve march-madness-v1/frontend -p 9000`), or  
   - **file:///.../march-madness-v1/frontend/index.html?api=http://localhost:8000**

You can run “Run daily picks”, “Send test SMS”, and see allowed numbers (if Statics has subscribed users with phone numbers).

---

## Quick reference

| What              | Command / URL |
|-------------------|----------------|
| Statics app       | `npm run dev` → http://localhost:3000 |
| March Madness API | `./march-madness-v1/scripts/run_local.sh` → http://localhost:8000 |
| March Madness UI  | Open `frontend/index.html?api=http://localhost:8000` (or serve on 9000) |
