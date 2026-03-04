import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId } = body;

    if (!userId) {
      return {
        success: false,
        message: 'User ID is required'
      };
    }

    // Get total earnings
    const earningsResponse = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userId}`,
        SK: 'EARNINGS#total'
      }
    }).promise();

    const totalEarnings = earningsResponse.Item?.totalEarnings || 0;

    // Get recent sales (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesResponse = await dynamodb.query({
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'purchaseDate >= :date',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'PURCHASE#',
        ':date': thirtyDaysAgo.toISOString()
      }
    }).promise();

    const recentSales = salesResponse.Items || [];

    return {
      success: true,
      totalEarnings: totalEarnings,
      recentSales: recentSales,
      recentSalesCount: recentSales.length
    };
  } catch (error) {
    console.error('Error getting earnings:', error);
    return {
      success: false,
      message: 'Failed to get earnings',
      error: error.message
    };
  }
}); 