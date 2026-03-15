/**
 * Environment and feature config.
 * All integrations use real AWS/Twilio when env vars are set.
 */

const env = process.env;

export const config = {
  app: {
    name: "Statics",
    baseUrl: env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
  cognito: {
    region: env.NEXT_PUBLIC_COGNITO_REGION || "us-east-1",
    userPoolId: env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
    userPoolWebClientId: env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
    /** Use real Cognito when User Pool and Client are set. */
    useReal: !!(env.NEXT_PUBLIC_COGNITO_USER_POOL_ID && env.NEXT_PUBLIC_COGNITO_CLIENT_ID),
  },
  twilio: {
    accountSid: env.TWILIO_ACCOUNT_SID || "",
    authToken: env.TWILIO_AUTH_TOKEN || "",
    phoneNumber: env.TWILIO_PHONE_NUMBER || "",
    /** Twilio Verify service ID (optional). When set, use Verify API for 2FA instead of SMS body + our code store. */
    verifyServiceId: env.TWILIO_VERIFY_SERVICE_ID || "",
    /** Use real Twilio when credentials are set. */
    useReal: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER),
  },
  dynamo: {
    region: env.AWS_REGION || "us-east-1",
    tables: {
      users: env.STATICS_USERS_TABLE || "",
      apps: env.STATICS_APPS_TABLE || "",
      subscriptions: env.STATICS_SUBSCRIPTIONS_TABLE || "",
      subscriptionStop: env.STATICS_SUBSCRIPTION_STOP_TABLE || "",
      /** Optional: for phone 2FA codes when running multiple instances (avoids in-memory loss). */
      verify: env.STATICS_VERIFY_TABLE || "",
    },
    /** Use real DynamoDB when region and table names are set. */
    useReal: !!(
      env.AWS_REGION &&
      env.STATICS_USERS_TABLE &&
      env.STATICS_APPS_TABLE &&
      env.STATICS_SUBSCRIPTIONS_TABLE &&
      env.STATICS_SUBSCRIPTION_STOP_TABLE
    ),
  },
  admin: {
    adminEmail: "dehyu.sinyan@gmail.com",
  },
} as const;
