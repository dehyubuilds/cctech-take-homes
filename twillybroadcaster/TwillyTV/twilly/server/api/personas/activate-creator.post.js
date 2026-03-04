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

    // Look up the collaborator invite
    const inviteResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: 'INVITE',
        SK: inviteCode
      }
    }).promise();

    if (!inviteResult.Item) {
      return {
        success: false,
        message: 'Invalid creator invite code'
      };
    }

    const invite = inviteResult.Item;

    // Check if invite is still valid
    if (invite.status !== 'active' || new Date(invite.expiresAt) < new Date()) {
      return {
        success: false,
        message: 'Creator invite has expired or is no longer valid'
      };
    }

    // Check if user already has creator persona for this channel
    const existingCreator = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userId}`,
        SK: `COLLABORATOR_ROLE#${invite.channelName}`
      }
    }).promise();

    if (existingCreator.Item) {
      return {
        success: false,
        message: 'User already has creator access to this channel'
      };
    }

    // Generate a stream key for the creator
    const baseStreamKey = `${invite.channelName}_${Math.random().toString(36).substring(2, 10)}`;
    const streamKey = baseStreamKey.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Create creator persona record
    const creatorData = {
      PK: `USER#${userId}`,
      SK: `COLLABORATOR_ROLE#${invite.channelName}`,
      channelId: invite.channelName,
      channelName: invite.channelName,
      streamKey: streamKey,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'creator',
      invitedBy: invite.channelOwnerEmail,
      inviteCode: inviteCode,
      hasPayoutSetup: false,
      payoutSetupRequired: true
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: creatorData
    }).promise();

    // Also create the channel collaborator record
    const channelCollaboratorData = {
      PK: `CHANNEL#${invite.channelName}`,
      SK: `COLLABORATOR#${userId}`,
      channelId: invite.channelName,
      channelName: invite.channelName,
      userId: userId,
      userEmail: userEmail,
      streamKey: streamKey,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'creator',
      hasPayoutSetup: false,
      payoutSetupRequired: true
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: channelCollaboratorData
    }).promise();

    // Mark invite as used
    await dynamodb.update({
      TableName: 'Twilly',
      Key: {
        PK: 'INVITE',
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

    // Get all available channels for this user
    const channelsResult = await dynamodb.query({
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'COLLABORATOR_ROLE#'
      }
    }).promise();

    const availableChannels = channelsResult.Items.map(item => ({
      channelName: item.channelName,
      channelId: item.channelId,
      streamKey: item.streamKey,
      joinedAt: item.joinedAt,
      status: item.status
    }));

    return {
      success: true,
      message: 'Creator persona activated successfully',
      activeChannel: invite.channelName,
      availableChannels: availableChannels,
      creatorData: creatorData
    };

  } catch (error) {
    console.error('Error activating creator persona:', error);
    return {
      success: false,
      message: 'Failed to activate creator persona',
      error: error.message
    };
  }
});
