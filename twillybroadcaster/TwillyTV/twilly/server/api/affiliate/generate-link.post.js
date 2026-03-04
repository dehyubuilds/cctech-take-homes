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
    const { 
      userId, 
      userEmail, 
      channelName, 
      contentId, 
      contentTitle,
      creatorEmail,
      creatorUsername
    } = body;

    if (!userId || !userEmail || !channelName) {
      return {
        success: false,
        message: 'Missing required fields: userId, userEmail, and channelName'
      };
    }

    // Verify user has affiliate persona
    const affiliateResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'AFFILIATE#main'
      }
    }).promise();

    if (!affiliateResult.Item) {
      return {
        success: false,
        message: 'User does not have affiliate persona activated'
      };
    }

    const affiliate = affiliateResult.Item;

    // Generate affiliate link with tracking
    const baseUrl = process.env.NODE_ENV === 'production' ? 'https://twilly.app' : 'http://localhost:3000';
    let affiliateUrl;

    if (contentId && contentTitle) {
      // Content-specific affiliate link
      affiliateUrl = `${baseUrl}/menu/share/${encodeURIComponent(creatorEmail)}/${encodeURIComponent(channelName)}/${encodeURIComponent(contentId)}?affiliate=${affiliate.affiliateCode}`;
    } else {
      // Channel affiliate link
      affiliateUrl = `${baseUrl}/menu/share/${encodeURIComponent(creatorEmail)}/${encodeURIComponent(channelName)}?affiliate=${affiliate.affiliateCode}`;
    }

    // Create affiliate tracking record
    const trackingRecord = {
      PK: `AFFILIATE_TRACKING#${affiliate.affiliateCode}`,
      SK: `LINK#${Date.now()}`,
      affiliateCode: affiliate.affiliateCode,
      affiliateId: userId,
      affiliateEmail: userEmail,
      channelName: channelName,
      contentId: contentId,
      contentTitle: contentTitle,
      creatorEmail: creatorEmail,
      creatorUsername: creatorUsername,
      affiliateUrl: affiliateUrl,
      createdAt: new Date().toISOString(),
      status: 'active',
      clickCount: 0,
      conversionCount: 0
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: trackingRecord
    }).promise();

    return {
      success: true,
      message: 'Affiliate link generated successfully',
      affiliateUrl: affiliateUrl,
      affiliateCode: affiliate.affiliateCode,
      commissionRate: affiliate.commissionRate
    };

  } catch (error) {
    console.error('Error generating affiliate link:', error);
    return {
      success: false,
      message: 'Failed to generate affiliate link',
      error: error.message
    };
  }
});
