import AWS from 'aws-sdk';
import crypto from 'crypto';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId, seriesName } = body;

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

    // First, find existing stream key for this user and series
    // Use a targeted scan with minimal filtering for efficiency
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

    const existingKeys = await dynamodb.scan(scanParams).promise();

    // Deactivate existing stream keys for this user/series
    if (existingKeys.Items && existingKeys.Items.length > 0) {
      const deactivatePromises = existingKeys.Items.map(item => {
        const deactivateParams = {
          TableName: 'Twilly',
          Key: {
            PK: item.PK,
            SK: item.SK
          },
          UpdateExpression: 'SET status = :status, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':status': 'INACTIVE',
            ':updatedAt': new Date().toISOString()
          }
        };
        return dynamodb.update(deactivateParams).promise();
      });

      await Promise.all(deactivatePromises);
      console.log(`Deactivated ${existingKeys.Items.length} existing stream keys`);
    }

    // Generate a new unique stream key
    const streamKey = `sk_${crypto.randomBytes(8).toString('hex')}`;
    const timestamp = new Date().toISOString();

    // Store the new stream key mapping
    const params = {
      TableName: 'Twilly',
      Item: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING',
        ownerEmail: userId,
        seriesName: seriesName,
        createdAt: timestamp,
        status: 'ACTIVE'
      }
    };

    await dynamodb.put(params).promise();

    console.log(`Regenerated stream key ${streamKey} for user ${userId} and series ${seriesName}`);

    return {
      success: true,
      streamKey: streamKey,
      message: 'Stream key regenerated successfully'
    };

  } catch (error) {
    console.error('Error regenerating stream key:', error);
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to regenerate stream key'
    });
  }
}); 