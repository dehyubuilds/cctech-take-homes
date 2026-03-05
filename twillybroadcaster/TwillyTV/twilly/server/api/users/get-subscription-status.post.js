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

    console.log(`📋 [get-subscription-status] Checking premium add: ${subscriberEmail} -> ${creatorEmail}`);

    const sub = (subscriberEmail || '').toLowerCase().trim();
    const cr = (creatorEmail || '').toLowerCase().trim();

    // Premium uses add model: ADDED_USERNAME#creatorEmail#premium under USER#viewer
    const addedPremium = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${sub}`,
        SK: `ADDED_USERNAME#${cr}#premium`
      }
    }).promise();

    if (addedPremium.Item && addedPremium.Item.status === 'active') {
      console.log(`✅ [get-subscription-status] Premium add found (active)`);
      return {
        success: true,
        isSubscribed: true,
        status: 'active',
        subscriptionId: null,
        createdAt: addedPremium.Item.addedAt || null,
        amount: null
      };
    }

    return {
      success: true,
      isSubscribed: false,
      status: 'none',
      subscriptionId: null,
      createdAt: null,
      amount: null
    };

  } catch (error) {
    console.error('❌ [get-subscription-status] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to get subscription status'
    });
  }
});
