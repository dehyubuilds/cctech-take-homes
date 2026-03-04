import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { affiliateId, channelName } = body;

    if (!affiliateId) {
      return {
        success: false,
        message: 'Missing required field: affiliateId'
      };
    }

    // Get affiliate profile
    const affiliateResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `AFFILIATE#${affiliateId}`,
        SK: 'PROFILE'
      }
    }).promise();

    if (!affiliateResult.Item) {
      return {
        success: false,
        message: 'Affiliate not found'
      };
    }

    const affiliate = affiliateResult.Item;

    // Query for tracking records
    let queryParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `AFFILIATE_TRACKING#${affiliateId}`
      }
    };

    // If channel name is specified, filter by it
    if (channelName) {
      queryParams.FilterExpression = 'channelName = :channelName';
      queryParams.ExpressionAttributeValues[':channelName'] = channelName;
    }

    const trackingResult = await dynamodb.query(queryParams).promise();
    const trackingRecords = trackingResult.Items || [];

    // Calculate earnings
    let totalEarnings = 0;
    let pendingEarnings = 0;
    let paidEarnings = 0;
    let activeSignups = 0;

    for (const record of trackingRecords) {
      if (record.status === 'active' || record.status === 'completed') {
        const estimatedMonthlyRevenue = 9.99; // Default subscription price
        const commission = estimatedMonthlyRevenue * affiliate.commissionRate;
        totalEarnings += commission;
        
        if (record.commissionPaid > 0) {
          paidEarnings += record.commissionPaid;
        } else {
          pendingEarnings += commission;
        }
        
        if (record.status === 'active') {
          activeSignups++;
        }
      }
    }

    // Format earnings history
    const earningsHistory = trackingRecords
      .filter(record => record.commissionEarned > 0)
      .map(record => ({
        trackingId: record.trackingId,
        talentEmail: record.talentEmail,
        talentUsername: record.talentUsername,
        talentFullName: record.talentFullName,
        channelName: record.channelName,
        signupDate: record.signupDate,
        status: record.status,
        commissionEarned: record.commissionEarned || 0,
        commissionPaid: record.commissionPaid || 0
      }))
      .sort((a, b) => new Date(b.signupDate) - new Date(a.signupDate));

    return {
      success: true,
      message: 'Channel earnings retrieved successfully',
      earnings: {
        affiliateId,
        channelName: channelName || 'all',
        totalEarnings,
        pendingEarnings,
        paidEarnings,
        activeSignups,
        commissionRate: affiliate.commissionRate,
        earningsHistory
      }
    };

  } catch (error) {
    console.error('Error getting channel earnings:', error);
    return {
      success: false,
      message: 'Failed to get channel earnings',
      error: error.message
    };
  }
});
