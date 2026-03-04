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
    const { userId, userEmail, channelName } = body;

    if (!userId || !userEmail || !channelName) {
      return {
        success: false,
        message: 'Missing required fields: userId, userEmail, and channelName'
      };
    }

    // Verify user has access to this channel
    const channelAccess = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userId}`,
        SK: `COLLABORATOR_ROLE#${channelName}`
      }
    }).promise();

    if (!channelAccess.Item) {
      return {
        success: false,
        message: 'User does not have access to this channel'
      };
    }

    // Update user's persona preferences with active channel
    const personaPrefs = {
      PK: `USER#${userEmail}`,
      SK: 'PERSONA_PREFS',
      userId: userId,
      userEmail: userEmail,
      activePersona: 'creator',
      activeChannel: channelName,
      lastSwitched: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: personaPrefs
    }).promise();

    return {
      success: true,
      message: `Switched to channel: ${channelName}`
    };

  } catch (error) {
    console.error('Error switching creator channel:', error);
    return {
      success: false,
      message: 'Failed to switch channel',
      error: error.message
    };
  }
});
