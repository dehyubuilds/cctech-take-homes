import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  
  try {
    const body = await readBody(event);
    const { userEmail } = body;

    if (!userEmail) {
      return {
        success: false,
        message: 'Missing required field: userEmail'
      };
    }

    // Get premium settings
    const premiumResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PREMIUM_SETTINGS'
      }
    }).promise();

    // Get Stripe Connect account status
    const stripeResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'STRIPE_CONNECT'
      }
    }).promise();

    const hasStripeAccount = !!(stripeResult.Item && stripeResult.Item.stripeAccountId);
    const isPremiumEnabled = !!(premiumResult.Item && premiumResult.Item.unitPrice);
    const unitPrice = premiumResult.Item?.unitPrice || premiumResult.Item?.subscriptionPrice || null;

    return {
      success: true,
      isPremiumEnabled,
      unitPrice,
      hasStripeAccount,
      // Legacy support
      subscriptionPrice: unitPrice
    };

  } catch (error) {
    console.error('Error getting premium status:', error);
    return {
      success: false,
      message: 'Failed to get premium status',
      error: error.message
    };
  }
});
