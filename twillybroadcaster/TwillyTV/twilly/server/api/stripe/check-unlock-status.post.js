import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  
  try {
    const body = await readBody(event);
    const { userEmail, videoId } = body;

    if (!userEmail || !videoId) {
      return {
        success: false,
        message: 'Missing required fields: userEmail, videoId'
      };
    }

    // Normalize videoId (remove FILE# prefix if present)
    const normalizedVideoId = videoId.replace(/^FILE#/, '');

    // Check if user has unlocked this video
    const unlockResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `UNLOCKED#${userEmail}`,
        SK: `ITEM#${normalizedVideoId}`
      }
    }).promise();

    // Also check purchase record (alternative lookup)
    const purchaseResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `PURCHASE#${userEmail}`,
        SK: `ITEM#${normalizedVideoId}`
      }
    }).promise();

    const isUnlocked = !!(unlockResult.Item || purchaseResult.Item);

    return {
      success: true,
      isUnlocked
    };

  } catch (error) {
    console.error('Error checking unlock status:', error);
    return {
      success: false,
      message: 'Failed to check unlock status',
      error: error.message
    };
  }
});
