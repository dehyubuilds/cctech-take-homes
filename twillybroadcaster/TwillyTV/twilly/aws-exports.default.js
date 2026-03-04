/**
 * Fallback aws-exports used when aws-exports.js is not present (e.g. Netlify build).
 * Set env vars in Netlify: COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, etc.
 * Local dev: use Amplify-generated aws-exports.js (gitignored) or set env vars.
 */
const region = process.env.AWS_REGION || 'us-east-1';
export default {
  region,
  identityPoolRegion: region,
  userPoolId: process.env.COGNITO_USER_POOL_ID || process.env.NUXT_PUBLIC_COGNITO_USER_POOL_ID || '',
  identityPoolId: process.env.COGNITO_IDENTITY_POOL_ID || process.env.NUXT_PUBLIC_COGNITO_IDENTITY_POOL_ID || '',
  userPoolWebClientId: process.env.COGNITO_CLIENT_ID || process.env.NUXT_PUBLIC_COGNITO_CLIENT_ID || '',
  mandatorySignIn: false,
  authenticationFlowType: process.env.COGNITO_AUTH_FLOW || 'USER_SRP_AUTH',
  API: {
    endpoints: [
      {
        name: 'StripeAPI',
        endpoint: process.env.STRIPE_API_ENDPOINT || 'https://cugmcgwakf.execute-api.us-east-2.amazonaws.com/prod/',
        region: process.env.AWS_REGION_API || 'us-east-2'
      }
    ]
  },
  s3: {
    bucket: process.env.S3_BUCKET || 'tpccollections',
    region
  }
};
