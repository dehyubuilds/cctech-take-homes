import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const table = 'Twilly';

  try {
    const body = await readBody(event);
    console.log('Storing casting director invite:', body);

    // Validate required fields
    if (!body.PK || !body.SK || !body.channelName || !body.channelOwnerEmail) {
      return {
        success: false,
        message: 'Missing required fields: PK, SK, channelName, channelOwnerEmail'
      };
    }

    // Store the casting director invite record
    await dynamodb.put({
      TableName: table,
      Item: body
    }).promise();

    console.log('Casting director invite stored successfully:', body.SK);

    return {
      success: true,
      message: 'Casting director invite stored successfully',
      inviteCode: body.SK
    };

  } catch (error) {
    console.error('Error storing casting director invite:', error);
    return {
      success: false,
      message: 'Failed to store casting director invite'
    };
  }
});
