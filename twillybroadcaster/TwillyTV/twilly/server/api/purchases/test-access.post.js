import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId, contentId } = body;

    console.log('Testing purchase access for:', { userId, contentId });

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

    console.log('Purchase access result:', {
      hasAccess,
      purchaseCount: result.Items.length,
      purchase: purchase ? {
        orderId: purchase.orderId,
        purchasedAt: purchase.purchasedAt,
        price: purchase.price
      } : null
    });

    return {
      success: true,
      data: {
        hasAccess,
        purchase: purchase ? {
          orderId: purchase.orderId,
          purchasedAt: purchase.purchasedAt,
          price: purchase.price
        } : null,
        allPurchases: result.Items.map(p => ({
          orderId: p.orderId,
          contentId: p.contentId,
          title: p.title,
          price: p.price,
          purchasedAt: p.purchasedAt
        }))
      }
    };

  } catch (error) {
    console.error('Error testing purchase access:', error);
    return {
      success: false,
      message: 'Failed to test purchase access',
      error: error.message
    };
  }
}); 