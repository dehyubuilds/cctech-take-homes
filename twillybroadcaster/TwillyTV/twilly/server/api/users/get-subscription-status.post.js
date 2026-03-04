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
    const { subscriberEmail, creatorEmail } = body;

    if (!subscriberEmail || !creatorEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: subscriberEmail, creatorEmail'
      });
    }

    console.log(`📋 [get-subscription-status] Checking subscription: ${subscriberEmail} -> ${creatorEmail}`);

    // Query for active subscription
    // Subscription records are stored with PK: USER#creatorEmail, SK: SUBSCRIPTION#subscriberEmail
    const subscriptionResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${creatorEmail}`,
        SK: `SUBSCRIPTION#${subscriberEmail}`
      }
    }).promise();

    if (!subscriptionResult.Item) {
      return {
        success: true,
        isSubscribed: false,
        status: 'none',
        subscriptionId: null
      };
    }

    const subscription = subscriptionResult.Item;
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const isSubscribed = isActive;

    console.log(`✅ [get-subscription-status] Subscription found: ${isSubscribed ? 'active' : subscription.status}`);

    return {
      success: true,
      isSubscribed,
      status: subscription.status || 'none',
      subscriptionId: subscription.subscriptionId || null,
      createdAt: subscription.createdAt || null,
      amount: subscription.amount || null
    };

  } catch (error) {
    console.error('❌ [get-subscription-status] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to get subscription status'
    });
  }
});
