import AWS from 'aws-sdk';

const dynamoDb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { username, series } = body;

    if (!username || !series) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Username and series are required'
      });
    }

    console.log('Getting poster URL for:', { username, series });

    // Query DynamoDB to get the folder data for this creator and series
    const folderParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${username}`,
        ':sk': `FOLDER#${series}`
      }
    };

    const folderResult = await dynamoDb.query(folderParams).promise();
    console.log('Folder query result:', folderResult);

    let posterUrl = 'default';
    if (folderResult.Items && folderResult.Items.length > 0) {
      const folder = folderResult.Items[0];
      posterUrl = folder.seriesPosterUrl || 'default';
      console.log('Found poster URL from folder:', posterUrl);
    } else {
      console.log('No folder found for username:', username, 'series:', series);
    }

    return {
      posterUrl,
      success: true
    };

  } catch (error) {
    console.error('Error getting poster URL:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to get poster URL'
    });
  }
}); 