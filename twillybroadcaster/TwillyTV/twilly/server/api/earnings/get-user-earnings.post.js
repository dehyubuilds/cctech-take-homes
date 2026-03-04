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
    const { userId, userEmail } = body;

    console.log('Getting user earnings:', { userId, userEmail });

    // Get all payout records for this user
    const payoutsResult = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `PARTICIPANT#${userId}`,
        ':sk': 'PAYOUT#'
      }
    }).promise();

    const payouts = payoutsResult.Items || [];
    console.log('Found payouts:', payouts.length);

    // Calculate totals
    let totalEarnings = 0;
    let monthlyEarnings = 0;
    let pendingEarnings = 0;
    const recentPayouts = [];

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    for (const payout of payouts) {
      const payoutAmount = parseFloat(payout.payoutAmount) || 0;
      totalEarnings += payoutAmount;

      // Check if payout is from current month
      const payoutDate = new Date(payout.orderDate);
      if (payoutDate.getMonth() === currentMonth && payoutDate.getFullYear() === currentYear) {
        monthlyEarnings += payoutAmount;
      }

      // Check if payout is pending
      if (payout.status === 'pending') {
        pendingEarnings += payoutAmount;
      }

      // Add to recent payouts (last 10)
      if (recentPayouts.length < 10) {
        recentPayouts.push({
          id: payout.orderId,
          channelName: payout.seriesName || 'Unknown Channel',
          amount: payoutAmount,
          date: payout.orderDate,
          status: payout.status
        });
      }
    }

    // Sort recent payouts by date (newest first)
    recentPayouts.sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log('Earnings calculated:', {
      totalEarnings,
      monthlyEarnings,
      pendingEarnings,
      recentPayoutsCount: recentPayouts.length
    });

    return {
      success: true,
      totalEarnings,
      monthlyEarnings,
      pendingEarnings,
      recentPayouts
    };

  } catch (error) {
    console.error('Error getting user earnings:', error);
    return {
      success: false,
      message: 'Failed to get user earnings',
      totalEarnings: 0,
      monthlyEarnings: 0,
      pendingEarnings: 0,
      recentPayouts: []
    };
  }
});
