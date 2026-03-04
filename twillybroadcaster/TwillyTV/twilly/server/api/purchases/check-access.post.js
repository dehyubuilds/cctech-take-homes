import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId, contentId } = body;

    if (!userId || !contentId) {
      return {
        success: false,
        message: 'Missing required fields: userId and contentId'
      };
    }

    // Check if user has purchased this content
    const result = await dynamodb.query({
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :userId AND begins_with(SK, :purchasePrefix)',
      FilterExpression: 'contentId = :contentId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':userId': `USER#${userId}`,
        ':purchasePrefix': 'PURCHASE#',
        ':contentId': contentId,
        ':status': 'active'
      }
    }).promise();

    const hasAccess = result.Items.length > 0;
    const purchase = hasAccess ? result.Items[0] : null;

    return {
      success: true,
      data: {
        hasAccess,
        purchase: purchase ? {
          orderId: purchase.orderId,
          purchasedAt: purchase.purchasedAt,
          price: purchase.price
        } : null
      }
    };

  } catch (error) {
    console.error('Error checking purchase access:', error);
    return {
      success: false,
      message: 'Failed to check purchase access'
    };
  }
}); 