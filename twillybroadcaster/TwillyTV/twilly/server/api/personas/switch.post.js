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
    const { userId, userEmail, activePersona } = body;

    if (!userId || !userEmail || !activePersona) {
      return {
        success: false,
        message: 'Missing required fields: userId, userEmail, and activePersona'
      };
    }

    // Validate persona
    const validPersonas = ['master', 'viewer', 'affiliate', 'creator'];
    if (!validPersonas.includes(activePersona)) {
      return {
        success: false,
        message: 'Invalid persona type'
      };
    }

    // Update user's persona preferences
    const personaPrefs = {
      PK: `USER#${userEmail}`,
      SK: 'PERSONA_PREFS',
      userId: userId,
      userEmail: userEmail,
      activePersona: activePersona,
      lastSwitched: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: personaPrefs
    }).promise();

    return {
      success: true,
      message: `Switched to ${activePersona} persona successfully`
    };

  } catch (error) {
    console.error('Error switching persona:', error);
    return {
      success: false,
      message: 'Failed to switch persona',
      error: error.message
    };
  }
});
