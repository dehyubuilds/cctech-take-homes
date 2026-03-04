import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const { userId } = event.context.params;

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: 'User ID is required'
      });
    }

    // Query for all purchases for this user
    const params = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'PURCHASE#'
      }
    };

    const result = await dynamodb.query(params).promise();
    
    // Transform the data for frontend consumption
    const purchases = result.Items.map(item => ({
      id: item.purchaseId,
      clipId: item.clipId,
      title: item.clipData?.title || 'Untitled Clip',
      description: item.clipData?.description || 'No description',
      amount: item.amount,
      purchaseDate: item.purchaseDate,
      status: item.status,
      creatorId: item.clipData?.creatorId,
      creatorName: item.clipData?.creatorName,
      clipUrl: item.clipData?.url,
      hlsUrl: item.clipData?.hlsUrl,
      thumbnailUrl: item.clipData?.thumbnailUrl,
      category: item.clipData?.category
    }));

    return {
      success: true,
      purchases: purchases
    };
  } catch (error) {
    console.error('Error fetching purchases:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch purchases'
    });
  }
}); 