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
    const { userEmail, subscriptionPrice } = body;

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: userEmail'
      });
    }

    if (subscriptionPrice !== null && subscriptionPrice !== undefined) {
      if (typeof subscriptionPrice !== 'number' || subscriptionPrice < 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'subscriptionPrice must be a non-negative number'
        });
      }
    }

    console.log(`💰 [set-premium-price] Setting subscription price for ${userEmail} to $${subscriptionPrice}`);

    // Store premium settings
    await dynamodb.put({
      TableName: table,
      Item: {
        PK: `USER#${userEmail}`,
        SK: 'PREMIUM_SETTINGS',
        subscriptionPrice: subscriptionPrice || null,
        updatedAt: new Date().toISOString()
      }
    }).promise();

    console.log(`✅ [set-premium-price] Subscription price updated successfully`);

    return {
      success: true,
      message: 'Subscription price updated successfully',
      subscriptionPrice: subscriptionPrice || null
    };

  } catch (error) {
    console.error('❌ [set-premium-price] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to set subscription price'
    });
  }
});
