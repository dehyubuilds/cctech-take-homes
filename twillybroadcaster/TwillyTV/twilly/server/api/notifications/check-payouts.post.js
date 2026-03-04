import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const table = 'Twilly';

  try {
    const body = await readBody(event);
    const { userId, userEmail, lastChecked } = body;

    console.log('Checking for new payouts:', { userId, userEmail, lastChecked });

    // Get all payout records for this user since last check
    const payoutsResult = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `PARTICIPANT#${userId}`,
        ':sk': 'PAYOUT#'
      }
    }).promise();

    const allPayouts = payoutsResult.Items || [];
    
    // Filter for new payouts since last check
    const newPayouts = allPayouts.filter(payout => {
      if (!lastChecked) return true; // First time checking
      return new Date(payout.createdAt) > new Date(lastChecked);
    });

    console.log('Found new payouts:', newPayouts.length);

    // Format notifications for new payouts
    const notifications = newPayouts.map(payout => ({
      type: payout.status === 'processed' ? 'success' : 'info',
      title: payout.status === 'processed' ? 'Payout Received!' : 'Payout Pending',
      message: `You've received a payout from ${payout.seriesName || 'Unknown Channel'}`,
      amount: parseFloat(payout.payoutAmount) || 0,
      payoutId: payout.orderId,
      status: payout.status,
      date: payout.createdAt
    }));

    return {
      success: true,
      notifications,
      newPayoutCount: newPayouts.length,
      lastChecked: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error checking for new payouts:', error);
    return {
      success: false,
      message: 'Failed to check for new payouts',
      notifications: [],
      newPayoutCount: 0
    };
  }
});
