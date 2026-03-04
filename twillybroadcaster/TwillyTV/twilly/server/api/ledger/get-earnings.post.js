import AWS from 'aws-sdk';

// Configure AWS SDK
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId, userEmail, persona, channelName } = body;

    if (!userId || !userEmail || !persona) {
      return {
        success: false,
        message: 'Missing required fields: userId, userEmail, and persona'
      };
    }

    let earnings = {
      totalEarnings: 0,
      pendingEarnings: 0,
      paidEarnings: 0,
      recentTransactions: [],
      monthlyBreakdown: {},
      channelBreakdown: {}
    };

    if (persona === 'creator') {
      // Get creator earnings
      const totalEarningsResult = await dynamodb.get({
        TableName: 'Twilly',
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'EARNINGS#total'
        }
      }).promise();

      if (totalEarningsResult.Item) {
        earnings.totalEarnings = totalEarningsResult.Item.totalEarnings || 0;
        earnings.pendingEarnings = totalEarningsResult.Item.pendingEarnings || 0;
        earnings.paidEarnings = totalEarningsResult.Item.paidEarnings || 0;
      }

      // Get channel-specific earnings
      const channelEarningsResult = await dynamodb.query({
        TableName: 'Twilly',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userEmail}`,
          ':sk': 'CHANNEL_EARNINGS#'
        }
      }).promise();

      if (channelEarningsResult.Items) {
        channelEarningsResult.Items.forEach(item => {
          const channel = item.channelName;
          earnings.channelBreakdown[channel] = {
            totalEarnings: item.totalEarnings || 0,
            pendingEarnings: item.pendingEarnings || 0,
            paidEarnings: item.paidEarnings || 0
          };
        });
      }

      // Get recent transactions
      const transactionsResult = await dynamodb.query({
        TableName: 'Twilly',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userEmail}`,
          ':sk': 'PURCHASE#'
        },
        ScanIndexForward: false,
        Limit: 20
      }).promise();

      if (transactionsResult.Items) {
        earnings.recentTransactions = transactionsResult.Items.map(item => ({
          id: item.purchaseId,
          contentTitle: item.contentTitle,
          amount: item.amount,
          date: item.purchaseDate,
          status: item.status,
          type: 'sale'
        }));
      }

    } else if (persona === 'affiliate') {
      // Get affiliate earnings
      const affiliateResult = await dynamodb.get({
        TableName: 'Twilly',
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'AFFILIATE#main'
        }
      }).promise();

      if (affiliateResult.Item) {
        earnings.totalEarnings = affiliateResult.Item.totalEarnings || 0;
        earnings.pendingEarnings = affiliateResult.Item.pendingEarnings || 0;
        earnings.paidEarnings = affiliateResult.Item.paidEarnings || 0;
        earnings.totalReferrals = affiliateResult.Item.totalReferrals || 0;
      }

      // Get recent commissions
      const commissionsResult = await dynamodb.query({
        TableName: 'Twilly',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userEmail}`,
          ':sk': 'COMMISSION#'
        },
        ScanIndexForward: false,
        Limit: 20
      }).promise();

      if (commissionsResult.Items) {
        earnings.recentTransactions = commissionsResult.Items.map(item => ({
          id: item.transactionId,
          contentTitle: item.contentTitle,
          creatorEmail: item.creatorEmail,
          amount: item.commissionAmount,
          date: item.earnedAt,
          status: item.status,
          type: 'commission'
        }));
      }

    } else if (persona === 'viewer') {
      // Get viewer purchase history
      const purchasesResult = await dynamodb.query({
        TableName: 'Twilly',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userEmail}`,
          ':sk': 'PURCHASE#'
        },
        ScanIndexForward: false,
        Limit: 50
      }).promise();

      if (purchasesResult.Items) {
        earnings.recentTransactions = purchasesResult.Items.map(item => ({
          id: item.purchaseId,
          contentTitle: item.contentTitle,
          creatorEmail: item.creatorEmail,
          amount: item.amount,
          date: item.purchaseDate,
          status: item.status,
          type: 'purchase'
        }));

        // Calculate total spent
        earnings.totalEarnings = purchasesResult.Items.reduce((total, item) => {
          return total + (item.amount || 0);
        }, 0);
      }
    }

    return {
      success: true,
      earnings: earnings
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
