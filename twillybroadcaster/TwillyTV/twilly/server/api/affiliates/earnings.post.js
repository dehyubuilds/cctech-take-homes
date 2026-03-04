import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { affiliateId } = body;

    if (!affiliateId) {
      return {
        success: false,
        message: 'Missing required field: affiliateId'
      };
    }

    // Get affiliate information
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

    // Get all tracking records for this affiliate
    const trackingResult = await dynamodb.query({
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `AFFILIATE_TRACKING#${affiliateId}`
      }
    }).promise();

    const trackingRecords = trackingResult.Items || [];

    // Calculate earnings from active signups
    let totalEarnings = 0;
    let pendingEarnings = 0;
    let paidEarnings = 0;
    let activeSignups = 0;

    for (const record of trackingRecords) {
      if (record.status === 'active' || record.status === 'completed') {
        // Calculate commission based on subscription revenue
        // This would typically come from actual subscription data
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

    // Get recent earnings history
    const earningsHistory = trackingRecords
      .filter(record => record.commissionEarned > 0)
      .map(record => ({
        trackingId: record.trackingId,
        talentUsername: record.talentUsername,
        channelName: record.channelName,
        signupDate: record.signupDate,
        commissionEarned: record.commissionEarned,
        commissionPaid: record.commissionPaid,
        status: record.status
      }))
      .sort((a, b) => new Date(b.signupDate) - new Date(a.signupDate));

    // Update affiliate stats
    await dynamodb.update({
      TableName: 'Twilly',
      Key: {
        PK: `AFFILIATE#${affiliateId}`,
        SK: 'PROFILE'
      },
      UpdateExpression: 'SET totalEarnings = :totalEarnings, activeSignups = :activeSignups, updatedAt = :timestamp',
      ExpressionAttributeValues: {
        ':totalEarnings': totalEarnings,
        ':activeSignups': activeSignups,
        ':timestamp': new Date().toISOString()
      }
    }).promise();

    return {
      success: true,
      message: 'Affiliate earnings retrieved successfully',
      earnings: {
        affiliateId,
        totalEarnings,
        pendingEarnings,
        paidEarnings,
        activeSignups,
        commissionRate: affiliate.commissionRate,
        earningsHistory
      }
    };

  } catch (error) {
    console.error('Error getting affiliate earnings:', error);
    return {
      success: false,
      message: 'Failed to get affiliate earnings',
      error: error.message
    };
  }
});
