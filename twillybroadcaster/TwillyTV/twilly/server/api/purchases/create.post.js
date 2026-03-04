import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { buyerId, clipId, clipData, amount, paymentMethod } = body;

    if (!buyerId || !clipId || !amount) {
      return {
        success: false,
        message: 'Missing required fields: buyerId, clipId, and amount are required'
      };
    }

    // Generate unique purchase ID
    const purchaseId = `purchase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Create purchase record
    const purchaseItem = {
      PK: `USER#${buyerId}`,
      SK: `PURCHASE#${purchaseId}`,
      purchaseId: purchaseId,
      clipId: clipId,
      clipData: clipData,
      amount: amount,
      paymentMethod: paymentMethod || 'direct',
      purchaseDate: timestamp,
      status: 'completed',
      type: 'purchase'
    };

    // Store purchase in DynamoDB
    await dynamodb.put({
      TableName: 'Twilly',
      Item: purchaseItem
    }).promise();

    // Update creator's earnings (70% of purchase)
    const creatorId = clipData.creatorId;
    const creatorEarnings = amount * 0.7;
    
    if (creatorId) {
      // Add to creator's earnings
      await dynamodb.update({
        TableName: 'Twilly',
        Key: {
          PK: `USER#${creatorId}`,
          SK: 'EARNINGS#total'
        },
        UpdateExpression: 'ADD totalEarnings :amount SET lastUpdated = :timestamp',
        ExpressionAttributeValues: {
          ':amount': creatorEarnings,
          ':timestamp': timestamp
        }
      }).promise();
    }

    return {
      success: true,
      message: 'Purchase completed successfully',
      purchaseId: purchaseId,
      data: {
        purchaseId: purchaseId,
        clipId: clipId,
        amount: amount,
        purchaseDate: timestamp
      }
    };
  } catch (error) {
    console.error('Error creating purchase:', error);
    return {
      success: false,
      message: 'Failed to process purchase'
    };
  }
}); 