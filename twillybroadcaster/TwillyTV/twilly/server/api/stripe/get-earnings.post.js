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
    const { userId, period = '30' } = body; // period in days

    if (!userId) {
      return {
        success: false,
        message: 'Missing required field: userId'
      };
    }

    console.log('Getting earnings for user:', userId, 'period:', period, 'days');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(period));

    // Get all subscription payments for this creator
    const subscriptionsResult = await dynamodb.query({
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'SUBSCRIPTION#'
      }
    }).promise();

    // Get revenue split records
    const revenueResult = await dynamodb.query({
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'REVENUE#'
      }
    }).promise();

    // Calculate earnings breakdown
    let totalEarnings = 0;
    let totalSubscriptions = 0;
    let totalRevenue = 0;
    const earningsByChannel = {};
    const monthlyBreakdown = {};

    // Process subscription payments
    for (const subscription of subscriptionsResult.Items) {
      if (subscription.status === 'completed' && new Date(subscription.processedAt) >= cutoffDate) {
        totalEarnings += subscription.ownerShare || 0;
        totalSubscriptions++;
        
        const month = new Date(subscription.processedAt).toISOString().slice(0, 7); // YYYY-MM
        monthlyBreakdown[month] = (monthlyBreakdown[month] || 0) + (subscription.ownerShare || 0);
        
        if (subscription.channelName) {
          earningsByChannel[subscription.channelName] = (earningsByChannel[subscription.channelName] || 0) + (subscription.ownerShare || 0);
        }
      }
    }

    // Process revenue splits
    for (const revenue of revenueResult.Items) {
      if (new Date(revenue.processedAt) >= cutoffDate) {
        totalRevenue += revenue.amount || 0;
      }
    }

    // Get recent transactions (last 10)
    const recentTransactions = subscriptionsResult.Items
      .filter(sub => sub.status === 'completed' && new Date(sub.processedAt) >= cutoffDate)
      .sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt))
      .slice(0, 10)
      .map(sub => ({
        id: sub.subscriptionId,
        amount: sub.ownerShare,
        channelName: sub.channelName,
        date: sub.processedAt,
        type: 'subscription_payment'
      }));

    // Calculate platform metrics (new model with affiliate marketers)
    const platformFee = totalRevenue * 0.10; // 10% platform fee
    const creatorShare = totalRevenue * 0.70; // 70% creator share
    const collaboratorShare = totalRevenue * 0.15; // 15% collaborator share
    const affiliateShare = totalRevenue * 0.05; // 5% affiliate share

    return {
      success: true,
      earnings: {
        totalEarnings,
        totalSubscriptions,
        totalRevenue,
        platformFee,
        creatorShare,
        collaboratorShare,
        earningsByChannel,
        monthlyBreakdown,
        recentTransactions
      },
      period: {
        days: parseInt(period),
        startDate: cutoffDate.toISOString(),
        endDate: new Date().toISOString()
      }
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