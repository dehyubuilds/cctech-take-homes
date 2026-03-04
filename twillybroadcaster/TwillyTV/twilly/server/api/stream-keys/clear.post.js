import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId, seriesName } = body;

    console.log('Clear request received:', { userId, seriesName });

    if (!userId || !seriesName) {
      throw createError({
        statusCode: 400,
        message: 'userId and seriesName are required'
      });
    }

    // Configure AWS SDK
    AWS.config.update({
      region: 'us-east-1',
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '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'
    });

    const dynamodb = new AWS.DynamoDB.DocumentClient();

    console.log('AWS SDK configured, attempting to scan for stream keys...');

    // Most efficient approach: Use a targeted scan with minimal filtering
    // Since we know stream keys have PK starting with 'STREAM_KEY#', we can optimize
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'begins_with(PK, :pkPrefix) AND ownerEmail = :userId AND seriesName = :seriesName AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pkPrefix': 'STREAM_KEY#',
        ':userId': userId,
        ':seriesName': seriesName,
        ':status': 'ACTIVE'
      }
    };

    console.log('Scan params:', scanParams);

    const existingKeys = await dynamodb.scan(scanParams).promise();

    console.log('Scan result:', {
      count: existingKeys.Items?.length || 0,
      items: existingKeys.Items
    });

    if (!existingKeys.Items || existingKeys.Items.length === 0) {
      return {
        success: true,
        message: 'No active stream keys found to clear'
      };
    }

    console.log(`Found ${existingKeys.Items.length} keys to delete...`);

    // Delete all existing stream keys for this user/series
    const deletePromises = existingKeys.Items.map(item => {
      const deleteParams = {
        TableName: 'Twilly',
        Key: {
          PK: item.PK,
          SK: item.SK
        }
      };
      console.log('Deleting item:', item.PK, 'with params:', deleteParams);
      return dynamodb.delete(deleteParams).promise();
    });

    console.log('Executing delete promises...');
    await Promise.all(deletePromises);

    console.log(`Deleted ${existingKeys.Items.length} stream keys for user ${userId} and series ${seriesName}`);

    return {
      success: true,
      message: `Deleted ${existingKeys.Items.length} stream key(s) successfully`
    };

  } catch (error) {
    console.error('Error clearing stream keys:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack
    });
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to clear stream keys'
    });
  }
}); 