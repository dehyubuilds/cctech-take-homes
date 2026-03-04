import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { 
      seriesId,
      orderId,
      orderAmount, // Total amount from Lemon Squeezy
      orderDate = new Date().toISOString()
    } = body;

    if (!seriesId || !orderId || !orderAmount) {
      return {
        success: false,
        message: 'Missing required fields: seriesId, orderId, and orderAmount are required'
      };
    }

    // Get series information and revenue shares
    const seriesResponse = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `SERIES#${seriesId}`,
        SK: 'METADATA'
      }
    }).promise();

    if (!seriesResponse.Item) {
      return {
        success: false,
        message: 'Series not found'
      };
    }

    const series = seriesResponse.Item;

    // Get revenue share records
    const revenueSharesResponse = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `SERIES#${seriesId}`,
        ':sk': 'REVENUE_SHARE#'
      }
    }).promise();

    const revenueShares = revenueSharesResponse.Items || [];

    // Calculate payouts for each participant
    const payouts = [];
    const payoutRecords = [];

    for (const share of revenueShares) {
      const payoutAmount = (orderAmount * share.percentage) / 100;
      
      const payout = {
        participantId: share.participantId,
        participantType: share.participantType,
        participantEmail: share.participantEmail,
        percentage: share.percentage,
        payoutAmount: payoutAmount,
        orderId: orderId,
        seriesId: seriesId,
        seriesName: series.seriesName,
        orderAmount: orderAmount,
        orderDate: orderDate
      };

      payouts.push(payout);

      // Create payout record for DynamoDB
      const payoutRecord = {
        PK: `PAYOUT#${orderId}`,
        SK: `PARTICIPANT#${share.participantId}`,
        participantId: share.participantId,
        participantType: share.participantType,
        participantEmail: share.participantEmail,
        percentage: share.percentage,
        payoutAmount: payoutAmount,
        orderId: orderId,
        seriesId: seriesId,
        seriesName: series.seriesName,
        orderAmount: orderAmount,
        orderDate: orderDate,
        status: 'pending', // pending, processed, failed
        processedAt: null,
        createdAt: new Date().toISOString()
      };

      payoutRecords.push(payoutRecord);

      // Create participant payout summary record
      const participantPayoutRecord = {
        PK: `PARTICIPANT#${share.participantId}`,
        SK: `PAYOUT#${orderId}`,
        orderId: orderId,
        seriesId: seriesId,
        seriesName: series.seriesName,
        payoutAmount: payoutAmount,
        percentage: share.percentage,
        orderDate: orderDate,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      payoutRecords.push(participantPayoutRecord);
    }

    // Store payout records in DynamoDB
    const writeRequests = payoutRecords.map(record => ({
      PutRequest: { Item: record }
    }));

    // Split into batches of 25 (DynamoDB limit)
    const batches = [];
    for (let i = 0; i < writeRequests.length; i += 25) {
      batches.push(writeRequests.slice(i, i + 25));
    }

    for (const batch of batches) {
      await dynamodb.batchWrite({
        RequestItems: {
          [table]: batch
        }
      }).promise();
    }

    // Update series total revenue
    const updateSeriesParams = {
      TableName: table,
      Key: {
        PK: `SERIES#${seriesId}`,
        SK: 'METADATA'
      },
      UpdateExpression: 'SET totalRevenue = totalRevenue + :amount, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':amount': orderAmount,
        ':updatedAt': new Date().toISOString()
      }
    };

    await dynamodb.update(updateSeriesParams).promise();

    console.log('Payouts processed successfully:', payouts);

    return {
      success: true,
      message: 'Payouts processed successfully',
      data: {
        orderId: orderId,
        seriesId: seriesId,
        orderAmount: orderAmount,
        payouts: payouts,
        totalPayouts: payouts.length
      }
    };

  } catch (error) {
    console.error('Error processing payouts:', error);
    return {
      success: false,
      message: 'Failed to process payouts',
      error: error.message
    };
  }
}); 