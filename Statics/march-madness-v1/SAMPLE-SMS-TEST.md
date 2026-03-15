# Sample SMS test (Twilio → subscribers)

We’re set up to pull everything needed to text subscribers:

- **Game data:** CBB API (`get_todays_games`, team/player stats).
- **Picks:** Built from that data (spread/total/prop, game label, start time).
- **Subscribers:** From Statics `GET /api/products/march-madness/allowed-numbers` (verified phones, `smsStatus` active).
- **SMS:** Twilio (`send_bulk_sms`).

## Run a sample test so you get a March Madness text

1. **Statics**
   - You’re subscribed to March Madness and your phone is verified (SMS status active).
   - Statics is running (or deployed) and has `STATICS_MARCH_MADNESS_API_KEY` set.

2. **March Madness `.env`**
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
   - `STATICS_BASE_URL` = your Statics URL (e.g. `https://your-statics.netlify.app` or `http://localhost:3000`)
   - `STATICS_API_KEY` = same value as Statics’ `STATICS_MARCH_MADNESS_API_KEY`

3. **Start March Madness backend**
   ```bash
   cd march-madness-v1 && ./scripts/run_local.sh
   ```

4. **Trigger sample send**
   - **Option A (UI):** Open `frontend/index.html?api=http://localhost:8000`, click **“Send sample to subscribers”**. You should get one sample SMS.
   - **Option B (curl):**
     ```bash
     curl -X POST http://localhost:8000/send-sample
     ```
   Response example: `{"sent_count": 1, "numbers_count": 1, "message_preview": "..."}`.

If `sent_count` is 0, check: Statics allowed-numbers returns your number (subscribe + verify phone), and `STATICS_BASE_URL` / `STATICS_API_KEY` in March Madness match Statics.
