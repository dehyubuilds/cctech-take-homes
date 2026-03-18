/**
 * Hardcoded config — no env vars. Values in place for deploy.
 * TODO: Move to env-only when ready (SOC 2).
 */
export const config = {
  aws: {
    accessKeyId: "AKIASCPOEM7JYLK5BJFR",
    secretAccessKey: "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",
    region: "us-east-1",
  },
  app: {
    name: "Statics",
    baseUrl: "https://animated-meerkat-c9b887.netlify.app",
  },
  cognito: {
    region: "us-east-1",
    userPoolId: "us-east-1_slQDFliti",
    userPoolWebClientId: "4pp9aeol19sug0i4rk8fvddcq1",
    useReal: true,
  },
  twilio: {
    accountSid: "AC51aa42874175a8f9a1f7b95f3a3a5fe6",
    authToken: "b7fcdf5c6b0a09f106f977b58ffaadc5",
    phoneNumber: "+12407529966",
    verifyServiceId: "VA4d6b7b83646a2ae33cd23aeacab37041",
    useReal: true,
  },
  dynamo: {
    region: "us-east-1",
    tables: {
      users: "statics_users",
      apps: "statics_apps",
      subscriptions: "statics_subscriptions",
      subscriptionStop: "statics_subscription_stop",
      verify: "statics_verify",
      dropflow_users: "dropflow_users",
      dropflow_beats: "dropflow_beats",
      dropflow_orders: "dropflow_orders",
      dropflow_events: "dropflow_events",
    },
    useReal: true,
  },
  dropflow: {
    platformFeePercent: 0.05,
    minPriceCents: 100,
    previewDurationSeconds: 15,
    bucket: "statics-dropflow-142770202579",
    baseUrl: "https://statics-dropflow-142770202579.s3.us-east-1.amazonaws.com",
    /** Lambda that generates 15s preview; leave empty to skip. When set, beats POST invokes it after create. */
    previewLambdaName: "dropflow-generate-preview",
  },
  stripe: {
    // Same Stripe account as Twilly (test key)
    secretKey: "sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0",
    webhookSecret: "whsec_CnYa17Pkp1zrLI7o1Ou9CXdISYwOfkF0", // Statics destination for /api/dropflow/webhook
    useReal: true,
  },
  resend: {
    apiKey: "", // Set Resend API key for receipt+license emails; leave empty to skip email
    from: "Dropflow <onboarding@resend.dev>",
  },
  avatar: {
    bucket: "statics-avatars-142770202579",
    baseUrl: "https://statics-avatars-142770202579.s3.us-east-1.amazonaws.com",
    useReal: true,
  },
  admin: {
    adminEmail: "dehyu.sinyan@gmail.com",
  },
} as const;
