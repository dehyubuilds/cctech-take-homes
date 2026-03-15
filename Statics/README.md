# Statics

Statics is a secure members-only platform where users sign up, add their phone number, browse a carousel of curated apps, and subscribe to receive SMS messages from those apps. Each app is a lightweight static frontend backed by AWS (Lambda, Step Functions, DynamoDB) and Twilio for SMS.

## Features

- **Auth**: Sign up, sign in, sign out. Cognito-ready; mock auth for local dev.
- **Roles**: `admin` (dehyu.sinyan@gmail.com), `user`.
- **Profile**: Email, phone number, phone verification status, SMS status, active subscriptions.
- **App marketplace**: Dashboard with app cards; subscribe/unsubscribe; view app (protected).
- **Public share pages**: `/apps/[slug]` — shareable landing pages with Open Graph and Twitter card metadata for rich link previews (iMessage, Android).
- **Protected app routes**: `/app/[slug]` — requires auth + subscription.
- **Admin**: Create/edit/delete apps, manage users, subscriber counts, share metadata. Admin-only routes under `/admin`.
- **Twilio**: Webhook placeholder at `/api/webhooks/twilio` for STOP/START/HELP and inbound SMS; design for opt-out (smsStatus → opted_out) and future START reactivation.

## Tech stack

- Next.js 14 (App Router), TypeScript, TailwindCSS
- Auth: Amazon Cognito (when configured); mock in-memory when not
- Backend: AWS Lambda + API Gateway, DynamoDB (mocked in V1)
- SMS: Twilio (mocked when env not set)
- Hosting: S3 + CloudFront assumption

## Project structure

```
src/
  app/                    # App Router
    api/                  # API routes
      auth/               # signin, signup, signout, session
      apps/               # list apps, get by slug
      user/               # profile, subscriptions
      subscribe/           # subscribe, unsubscribe
      admin/              # admin apps, users (protected by role)
      webhooks/twilio/    # Twilio inbound webhook
      health/
    apps/[slug]/          # Public shareable app landing (metadata)
    app/[slug]/           # Protected app experience
    dashboard/            # Protected dashboard
    profile/              # Protected profile
    admin/                # Admin layout + overview, apps, users
    login/ signup/        # Auth pages
  components/            # Nav, AuthProvider, AppCard
  lib/
    domain/               # Types (User, App, Subscription, SmsEvent, enums)
    config.ts             # Env and feature flags
    seed-data.ts          # Seed users, apps, subscriptions
    repositories/         # Mock user, app, subscription repos
    services/             # Auth, entitlement, Twilio adapter
  middleware.ts           # Placeholder for future edge auth
```

## Setup

1. **Install and run (mock mode)**

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Use mock auth: sign up any email, then log in with that email and any password.

2. **Seed admin**

   Seed data includes admin `dehyu.sinyan@gmail.com`. To log in as admin in mock mode, ensure that email exists in seed (it does). Sign up with that email once, then sign in — role is set to `admin` for that email.

3. **Cognito (production)**

   Create a separate Cognito User Pool for Statics (do not reuse Twilly pools in production). Suggested steps:

   - AWS Console → Cognito → Create user pool (e.g. email sign-in, optional phone).
   - App client with USER_PASSWORD_AUTH if using email/password.
   - Set env:

   ```env
   NEXT_PUBLIC_COGNITO_REGION=us-east-1
   NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
   NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxx
   ```

   Then implement Cognito in `src/lib/services/auth-service.ts` (replace mock with Amplify or Cognito API calls) and sync user records to DynamoDB.

4. **Twilio**

   - Create Twilio account; get Account SID, Auth Token, phone number.
   - Configure webhook URL for your Statics API: `https://your-api/api/webhooks/twilio`.
   - Set env (server-side only): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

5. **DynamoDB**

   When moving off mocks, create tables for Users, Apps, Subscriptions, SmsEvents and wire `src/lib/repositories` to DynamoDB (single-table or multi-table design). Keep the same interfaces so services do not change.

## Environment variables

See `.env.example`. Key vars:

- `NEXT_PUBLIC_APP_URL` — Base URL for canonical and og:url (e.g. https://statics.example.com).
- Cognito: `NEXT_PUBLIC_COGNITO_REGION`, `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`.
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (server-only).
- AWS: `AWS_REGION` (and credentials) when using real DynamoDB/Lambda.

## Testing end-to-end (mock)

1. Sign up with `dehyu.sinyan@gmail.com` (or any email).
2. Log in → redirect to dashboard. See “Daily March Madness Picks” (seed app).
3. Subscribe to the app; open “View app” → protected app content.
4. Visit `/apps/daily-march-madness-picks` (public share page) in an incognito window — no login required; rich metadata for link previews.
5. As admin, go to `/admin` → overview; `/admin/apps` → list/edit apps; `/admin/users` → list users.

## E2E with real DynamoDB and Netlify deploy

For **real DynamoDB**, **phone verification**, and **deploy to Netlify**, see **[docs/E2E-AND-NETLIFY-DEPLOY.md](docs/E2E-AND-NETLIFY-DEPLOY.md)**. It covers: creating DynamoDB tables, `.env.local` for local E2E, step-by-step E2E test flow (auth, profile, save phone, verify code, subscribe), and Netlify env vars + deploy steps.

## Premiere app: Daily March Madness Picks

- Public landing: `/apps/daily-march-madness-picks`.
- Protected experience: `/app/daily-march-madness-picks` (after subscribe).
- Workflow placeholders: fetch games → analyze stats → compute edges → generate explanation → load subscribers from Dynamo → send SMS via Twilio.

## Security and entitlements

- Protected routes require auth (client-side check + API Bearer token). Add middleware or edge auth when moving to production.
- App access requires active subscription (entitlement check in `/app/[slug]` and APIs).
- Admin routes and `/api/admin/*` require `role === 'admin'` or admin email.
- Public share URLs are safe to share; protected app URLs enforce auth and subscription.

## License

Private.
