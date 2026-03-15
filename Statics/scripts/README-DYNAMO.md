# DynamoDB tables for Statics

When `STATICS_*_TABLE` env vars and `AWS_REGION` are set, the app uses real DynamoDB. Create these tables (e.g. via AWS Console or CDK) with the following key and GSI definitions.

## statics_users (STATICS_USERS_TABLE)

- **Partition key:** `userId` (String)
- **GSI:** `email-index` — Partition key: `email` (String). Use lowercase email.
- **GSI:** `phone-index` — Partition key: `phoneNormalized` (String). Store digits-only phone for lookups.

## statics_apps (STATICS_APPS_TABLE)

- **Partition key:** `appId` (String)
- **GSI:** `slug-index` — Partition key: `slug` (String)
- **GSI:** `status-index` — Partition key: `status` (String), for listing by status.

## statics_subscriptions (STATICS_SUBSCRIPTIONS_TABLE)

- **Partition key:** `subscriptionId` (String)
- **GSI:** `user-app-index` — Partition key: `userId` (String), Sort key: `appId` (String)
- **GSI:** `app-index` — Partition key: `appId` (String)

## statics_subscription_stop (STATICS_SUBSCRIPTION_STOP_TABLE)

- **Partition key:** `pk` (String) — store `appId` as value.
- **Sort key:** `sk` (String) — store `entryId` as value.
- Items also include: `entryId`, `appId`, `reason`, `createdAt` for application use.
