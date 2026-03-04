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
    const { userId, userEmail, inviteCode } = body;

    if (!userId || !userEmail || !inviteCode) {
      return {
        success: false,
        message: 'Missing required fields: userId, userEmail, and inviteCode'
      };
    }

    // Look up the affiliate invite
    const inviteResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: 'AFFILIATE_INVITE',
        SK: inviteCode
      }
    }).promise();

    if (!inviteResult.Item) {
      return {
        success: false,
        message: 'Invalid affiliate invite code'
      };
    }

    const invite = inviteResult.Item;

    // Check if invite is still valid
    if (invite.status !== 'active' || new Date(invite.expiresAt) < new Date()) {
      return {
        success: false,
        message: 'Affiliate invite has expired or is no longer valid'
      };
    }

    // Check if user already has affiliate persona
    const existingAffiliate = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'AFFILIATE#main'
      }
    }).promise();

    if (existingAffiliate.Item) {
      return {
        success: false,
        message: 'User already has affiliate persona activated'
      };
    }

    // Generate unique affiliate code
    const affiliateCode = `AFF${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create affiliate persona record
    const affiliateData = {
      PK: `USER#${userEmail}`,
      SK: 'AFFILIATE#main',
      userId: userId,
      userEmail: userEmail,
      affiliateCode: affiliateCode,
      commissionRate: invite.commissionRate || 0.1,
      invitedBy: invite.invitedBy,
      inviteCode: inviteCode,
      activatedAt: new Date().toISOString(),
      status: 'active',
      totalEarnings: 0,
      pendingEarnings: 0,
      totalReferrals: 0
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: affiliateData
    }).promise();

    // Mark invite as used
    await dynamodb.update({
      TableName: 'Twilly',
      Key: {
        PK: 'AFFILIATE_INVITE',
        SK: inviteCode
      },
      UpdateExpression: 'SET #status = :status, usedBy = :usedBy, usedAt = :usedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'used',
        ':usedBy': userEmail,
        ':usedAt': new Date().toISOString()
      }
    }).promise();

    return {
      success: true,
      message: 'Affiliate persona activated successfully',
      affiliateCode: affiliateCode,
      commissionRate: invite.commissionRate || 0.1,
      affiliateData: affiliateData
    };

  } catch (error) {
    console.error('Error activating affiliate persona:', error);
    return {
      success: false,
      message: 'Failed to activate affiliate persona',
      error: error.message
    };
  }
});
