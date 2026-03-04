import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { 
      PK, 
      SK, 
      channelName, 
      channelOwnerEmail, 
      channelOwnerId, 
      createdAt, 
      expiresAt, 
      status, 
      commissionRate 
    } = body;

    if (!PK || !SK || !channelName || !channelOwnerEmail) {
      return {
        success: false,
        message: 'Missing required fields: PK, SK, channelName, channelOwnerEmail'
      };
    }

    const affiliateInviteRecord = {
      PK,
      SK,
      channelName,
      channelOwnerEmail,
      channelOwnerId: channelOwnerId || null,
      createdAt: createdAt || new Date().toISOString(),
      expiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days default
      status: status || 'active',
      commissionRate: commissionRate || 0.05, // 5% default
      updatedAt: new Date().toISOString()
    };

    // Store the affiliate invite record
    await dynamodb.put({
      TableName: 'Twilly',
      Item: affiliateInviteRecord
    }).promise();

    // Also create a reference for quick lookup by channel
    const channelReference = {
      PK: `AFFILIATE_INVITE_CHANNEL#${channelOwnerEmail}#${channelName}`,
      SK: SK,
      inviteCode: SK,
      channelName,
      channelOwnerEmail,
      status: 'active',
      createdAt: affiliateInviteRecord.createdAt,
      expiresAt: affiliateInviteRecord.expiresAt
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: channelReference
    }).promise();

    return {
      success: true,
      message: 'Affiliate invite stored successfully',
      inviteCode: SK,
      channelName,
      commissionRate: affiliateInviteRecord.commissionRate
    };

  } catch (error) {
    console.error('Error storing affiliate invite:', error);
    return {
      success: false,
      message: 'Failed to store affiliate invite',
      error: error.message
    };
  }
});
