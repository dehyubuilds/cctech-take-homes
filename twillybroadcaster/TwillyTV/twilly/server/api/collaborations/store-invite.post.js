import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { PK, SK, channelName, channelOwnerEmail, channelOwnerId, createdAt, expiresAt, status } = body;

    console.log('Storing invite:', { PK, SK, channelName, channelOwnerEmail });

    // Validate required fields
    if (!PK || !SK || !channelName || !channelOwnerEmail || !channelOwnerId) {
      return {
        success: false,
        message: 'Missing required fields'
      };
    }

    // Store the invite record
    const inviteRecord = {
      PK,
      SK,
      channelName,
      channelOwnerEmail,
      channelOwnerId,
      createdAt,
      expiresAt,
      status
    };

    await dynamodb.put({
      TableName: table,
      Item: inviteRecord
    }).promise();

    console.log('Invite stored successfully:', SK);

    return {
      success: true,
      message: 'Invite stored successfully'
    };

  } catch (error) {
    console.error('Error storing invite:', error);
    return {
      success: false,
      message: 'Failed to store invite'
    };
  }
}); 