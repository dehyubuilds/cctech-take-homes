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

    // Query all purchases for this user
    const purchaseResult = await dynamodb.query({
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `PURCHASE#${userEmail}`
      }
    }).promise();

    const purchases = (purchaseResult.Items || []).map(item => ({
      purchaseId: item.SK.replace('ITEM#', ''),
      clipId: item.SK.replace('ITEM#', ''),
      title: item.title || 'Premium Content',
      price: item.price || 0,
      purchasedAt: item.purchasedAt || item.createdAt,
      creatorId: item.creatorId || '',
      creatorUsername: item.creatorUsername || item.creatorId || 'Unknown'
    }));

    // Sort by purchase date (newest first)
    purchases.sort((a, b) => 
      new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
    );

    return {
      success: true,
      purchases
    };

  } catch (error) {
    console.error('Error getting purchase history:', error);
    return {
      success: false,
      message: 'Failed to get purchase history',
      error: error.message
    };
  }
});
