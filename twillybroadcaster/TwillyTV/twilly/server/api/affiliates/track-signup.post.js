import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1'
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { affiliateId, talentData } = body;

    if (!affiliateId || !talentData) {
      return {
        success: false,
        message: 'Missing required fields: affiliateId and talentData are required'
      };
    }

    const timestamp = new Date().toISOString();
    const trackingId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    if (affiliate.status !== 'active') {
      return {
        success: false,
        message: 'Affiliate account is not active'
      };
    }

    // Create tracking record
    const trackingRecord = {
      PK: `AFFILIATE_TRACKING#${trackingId}`,
      SK: 'SIGNUP',
      trackingId,
      affiliateId,
      affiliateEmail: affiliate.email,
      affiliateUsername: affiliate.username,
      talentEmail: talentData.email,
      talentUsername: talentData.username,
      talentFullName: talentData.fullName,
      channelId: talentData.channelId,
      channelName: talentData.channelName,
      signupDate: timestamp,
      status: 'pending', // pending, active, completed, cancelled
      commissionEarned: 0,
      commissionPaid: 0,
      lastActivity: timestamp,
      notes: talentData.notes || null
    };

    // Store tracking record
    await dynamodb.put({
      TableName: 'Twilly',
      Item: trackingRecord
    }).promise();

    // Create reverse lookup for talent
    await dynamodb.put({
      TableName: 'Twilly',
      Item: {
        PK: `TALENT_AFFILIATE#${talentData.email}`,
        SK: `TRACKING#${trackingId}`,
        trackingId,
        affiliateId,
        affiliateEmail: affiliate.email,
        affiliateUsername: affiliate.username,
        signupDate: timestamp,
        status: 'pending'
      }
    }).promise();

    // Update affiliate stats
    await dynamodb.update({
      TableName: 'Twilly',
      Key: {
        PK: `AFFILIATE#${affiliateId}`,
        SK: 'PROFILE'
      },
      UpdateExpression: 'ADD totalSignups :inc SET updatedAt = :timestamp',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':timestamp': timestamp
      }
    }).promise();

    // Create talent request record if provided
    if (talentData.talentRequest) {
      const talentRequestRecord = {
        PK: `TALENT_REQUEST#${trackingId}`,
        SK: 'DETAILS',
        trackingId,
        affiliateId,
        affiliateEmail: affiliate.email,
        projectTitle: talentData.talentRequest.projectTitle,
        channel: talentData.talentRequest.channel,
        streamType: talentData.talentRequest.streamType,
        showConcept: talentData.talentRequest.showConcept,
        castingNeeds: talentData.talentRequest.castingNeeds,
        streamLength: talentData.talentRequest.streamLength,
        location: talentData.talentRequest.location,
        startDate: talentData.talentRequest.startDate,
        timeSlots: talentData.talentRequest.timeSlots,
        revenueShare: talentData.talentRequest.revenueShare,
        inspirationLink: talentData.talentRequest.inspirationLink,
        inspirationImage: talentData.talentRequest.inspirationImage,
        pilotUrl: talentData.talentRequest.pilotUrl,
        channelPosterUrl: talentData.talentRequest.channelPosterUrl,
        tags: talentData.talentRequest.tags || [],
        isPublic: true,
        status: 'pending_review',
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await dynamodb.put({
        TableName: 'Twilly',
        Item: talentRequestRecord
      }).promise();
    }

    return {
      success: true,
      message: 'Affiliate signup tracked successfully',
      trackingId,
      affiliate: {
        affiliateId,
        email: affiliate.email,
        username: affiliate.username,
        commissionRate: affiliate.commissionRate
      }
    };

  } catch (error) {
    console.error('Error tracking affiliate signup:', error);
    return {
      success: false,
      message: 'Failed to track affiliate signup',
      error: error.message
    };
  }
});
