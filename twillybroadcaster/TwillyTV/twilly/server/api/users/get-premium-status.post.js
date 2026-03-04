import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userEmail } = body;

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: userEmail'
      });
    }

    console.log(`💰 [get-premium-status] Getting Premium status for ${userEmail}`);

    // Get user profile
    const profileResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      }
    }).promise();

    // Get Stripe Connect account status
    const stripeResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'STRIPE_CONNECT'
      }
    }).promise();

    // Get subscription price if set
    const priceResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PREMIUM_SETTINGS'
      }
    }).promise();

    const hasStripeAccount = !!stripeResult.Item?.stripeAccountId;
    const stripeStatus = stripeResult.Item?.status || 'none';
    const isStripeActive = stripeStatus === 'connected' || stripeStatus === 'active';
    const subscriptionPrice = priceResult.Item?.subscriptionPrice || null;
    const isPremiumEnabled = profileResult.Item?.isPremiumEnabled || false;

    // Premium is active if: Stripe account exists and is active, AND premium is enabled
    const isPremium = isPremiumEnabled && hasStripeAccount && isStripeActive;

    console.log(`✅ [get-premium-status] Premium status: ${isPremium}, Stripe: ${stripeStatus}, Price: ${subscriptionPrice}`);

    return {
      success: true,
      isPremium,
      isPremiumEnabled,
      hasStripeAccount,
      stripeStatus,
      stripeAccountId: stripeResult.Item?.stripeAccountId || null,
      subscriptionPrice,
      onboardingUrl: stripeResult.Item?.onboardingUrl || null,
      dashboardUrl: stripeResult.Item?.dashboardUrl || null
    };

  } catch (error) {
    console.error('❌ [get-premium-status] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to get Premium status'
    });
  }
});
