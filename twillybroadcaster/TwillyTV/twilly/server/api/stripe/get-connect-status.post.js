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

    // Get Stripe Connect account status
    const stripeResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'STRIPE_CONNECT'
      }
    }).promise();

    if (!stripeResult.Item || !stripeResult.Item.stripeAccountId) {
      return {
        success: true,
        hasAccount: false,
        onboardingUrl: null
      };
    }

    const account = stripeResult.Item;
    const isConnected = account.status === 'connected' || 
                       (account.charges_enabled && account.payouts_enabled);

    return {
      success: true,
      hasAccount: true,
      accountId: account.stripeAccountId,
      status: account.status || 'pending',
      onboardingUrl: account.onboardingUrl || null,
      dashboardUrl: account.dashboardUrl || null
    };

  } catch (error) {
    console.error('Error getting connect status:', error);
    return {
      success: false,
      message: 'Failed to get connect status',
      error: error.message
    };
  }
});
