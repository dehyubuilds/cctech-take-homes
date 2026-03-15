# Statics – Folder structure

```
Statics/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/           # signin, signup, signout, session
│   │   │   ├── apps/           # GET list, GET [slug]
│   │   │   ├── user/           # profile (GET/PATCH), subscriptions (GET)
│   │   │   ├── subscribe/      # POST subscribe
│   │   │   ├── unsubscribe/    # POST unsubscribe
│   │   │   ├── admin/          # apps (GET/POST), apps/[appId] (PATCH/DELETE), apps/[appId]/subscribers, users
│   │   │   ├── webhooks/
│   │   │   │   └── twilio/     # POST inbound SMS (STOP/START/HELP)
│   │   │   └── health/
│   │   ├── apps/[slug]/        # Public shareable landing (dynamic metadata)
│   │   ├── app/[slug]/         # Protected app experience (auth + subscription)
│   │   ├── dashboard/          # Protected
│   │   ├── profile/            # Protected
│   │   ├── admin/              # Admin layout, overview, apps, users
│   │   ├── login/ signup/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Home
│   │   └── globals.css
│   ├── components/
│   │   ├── Nav.tsx
│   │   ├── AuthProvider.tsx
│   │   └── AppCard.tsx
│   ├── lib/
│   │   ├── domain/
│   │   │   ├── types.ts        # User, App, Subscription, SmsEvent, enums
│   │   │   └── index.ts
│   │   ├── config.ts
│   │   ├── seed-data.ts
│   │   ├── repositories/       # Mock user, app, subscription
│   │   └── services/           # Auth, entitlement, Twilio adapter
│   └── middleware.ts
├── docs/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── postcss.config.mjs
├── .env.example
└── README.md
```
