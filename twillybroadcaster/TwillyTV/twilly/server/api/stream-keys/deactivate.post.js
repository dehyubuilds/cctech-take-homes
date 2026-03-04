import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { streamKey } = body;

    console.log('Deactivate request received:', { streamKey });
    console.log('Full request body:', body);

    if (!streamKey) {
      throw createError({
        statusCode: 400,
        message: 'streamKey is required'
      });
    }

    // Configure AWS SDK
    AWS.config.update({
      region: 'us-east-1',
      accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
      secretAccessKey: '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'
    });

    const dynamodb = new AWS.DynamoDB.DocumentClient();

    console.log('AWS SDK configured, attempting to get stream key...');

    // First, get the stream key details to verify it exists and is active
    // We need to scan to find the stream key since we don't know the user email
    // Check both new structure (streamKey field) and old structure (PK contains stream key)
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'streamKey = :streamKey OR begins_with(PK, :pkPrefix)',
      ExpressionAttributeValues: {
        ':streamKey': streamKey,
        ':pkPrefix': `STREAM_KEY#${streamKey}`
      }
    };

    console.log('Scan params:', scanParams);

    const existingKeys = await dynamodb.scan(scanParams).promise();

    console.log('Scan result:', existingKeys);

    if (!existingKeys.Items || existingKeys.Items.length === 0) {
      throw createError({
        statusCode: 404,
        message: 'Stream key not found'
      });
    }

    // Filter out file records and find the actual stream key record
    const streamKeyRecord = existingKeys.Items.find(item => 
      item.PK && item.PK.startsWith('STREAM_KEY#') && 
      (item.streamKey === streamKey || item.SK === streamKey)
    );
    
    if (!streamKeyRecord) {
      throw createError({
        statusCode: 404,
        message: 'Stream key record not found'
      });
    }
    
    console.log('Stream key record found:', streamKeyRecord);

    if (streamKeyRecord.isActive === false) {
      throw createError({
        statusCode: 400,
        message: 'Stream key is already inactive'
      });
    }

    console.log('Key is active, attempting to deactivate...');

    // Deactivate the stream key
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: streamKeyRecord.PK,
        SK: streamKeyRecord.SK
      },
      UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isActive': false,
        ':updatedAt': new Date().toISOString()
      }
    };

    console.log('Update params:', updateParams);

    await dynamodb.update(updateParams).promise();

    console.log(`Deactivated stream key: ${streamKey}`);

    return {
      success: true,
      message: 'Stream key deactivated successfully'
    };

  } catch (error) {
    console.error('Error deactivating stream key:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack
    });
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to deactivate stream key'
    });
  }
}); 