# Cognito and Twilio setup (reference from Twilly)

Statics uses a **separate** Cognito User Pool. Reuse patterns from Twilly but do not share pool IDs in production.

## Twilly reference (this project)

- **Cognito**: Multiple pools in `us-east-1` (e.g. `us-east-1_ydIfTK3KE` for phone auth, `us-east-1_uBLoZgofg` for 2FA). Auth: `Auth.configure({ userPoolId, userPoolWebClientId, usernameAttributes: ['email'] })`; sign-in with `Auth.signIn({ username: email, password })`; confirm with `Auth.confirmSignUp`.
- **Twilio**: Verify API for SMS codes (`twilio.verify.v2.services(verifyServiceId).verifications.create({ to, channel: 'sms' })`). Credentials from env (avoid hardcoding). Format phone to E.164 before sending.

## Statics – what to do

1. **Cognito**
   - Create a new User Pool (e.g. email sign-in, optional phone).
   - Create an App client with `USER_PASSWORD_AUTH`.
   - Set `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NEXT_PUBLIC_COGNITO_REGION` in `.env.local`.
   - In `src/lib/services/auth-service.ts`, replace mock sign-in/sign-up with Cognito (Amplify or `@aws-sdk/client-cognito-identity-provider`). On first sign-in, create or update user in DynamoDB (userId = Cognito sub, email, role, smsStatus, etc.).

2. **Twilio**
   - Create account; get Account SID, Auth Token, and a phone number.
   - Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (server-only).
   - In `src/lib/services/twilio-adapter.ts`, replace mock with `twilio.messages.create({ to, from: TWILIO_PHONE_NUMBER, body })`.
   - Point your Twilio number’s webhook to `https://your-domain/api/webhooks/twilio`. Implement signature verification in that route.

3. **DynamoDB**
   - Tables: Users (PK userId), Apps (PK appId, GSI slug), Subscriptions (PK userId, SK appId or composite), SmsEvents (for audit).
   - Replace mock repositories in `src/lib/repositories` with DynamoDB clients; keep the same interface so services stay unchanged.

4. **Lambda / security**
   - You can put API Gateway in front of Next.js or use Lambda for sensitive ops (e.g. admin create app, update user smsStatus). Statics API routes can call Lambda or DynamoDB directly with IAM; keep least privilege and audit logging for SOC 2.
