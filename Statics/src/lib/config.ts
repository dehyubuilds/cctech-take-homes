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
    },
    useReal: true,
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
