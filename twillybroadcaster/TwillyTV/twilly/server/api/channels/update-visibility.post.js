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
    const { channelId, channelName, creatorUsername, visibility, isPublic } = body;

    // Support both new visibility string and old isPublic boolean
    let finalVisibility = visibility || (isPublic ? 'public' : 'private');
    let finalIsPublic = isPublic !== undefined ? isPublic : (finalVisibility === 'public');

    console.log('Updating channel visibility:', { channelId, channelName, creatorUsername, visibility: finalVisibility, isPublic: finalIsPublic });

    // Update or create channel metadata with visibility setting
    const channelMetadata = {
      PK: `CHANNEL#${channelId}`,
      SK: 'METADATA',
      channelId: channelId,
      channelName: channelName,
      creatorUsername: creatorUsername,
      visibility: finalVisibility, // New: 'private', 'searchable', or 'public'
      isPublic: finalIsPublic, // Keep for backward compatibility
      updatedAt: new Date().toISOString()
    };

    // Check if channel metadata already exists
    const existingResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${channelId}`,
        SK: 'METADATA'
      }
    }).promise();

    if (existingResult.Item) {
      // Update existing metadata
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelId}`,
          SK: 'METADATA'
        },
        UpdateExpression: 'SET visibility = :visibility, isPublic = :isPublic, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':visibility': finalVisibility,
          ':isPublic': finalIsPublic,
          ':updatedAt': new Date().toISOString()
        }
      }).promise();
    } else {
      // Create new metadata
      channelMetadata.createdAt = new Date().toISOString();
      await dynamodb.put({
        TableName: table,
        Item: channelMetadata
      }).promise();
    }

    console.log('Channel visibility updated successfully');

    const visibilityLabels = {
      'public': 'Public',
      'searchable': 'Searchable',
      'private': 'Private'
    };

    return {
      success: true,
      message: `Channel visibility updated to ${visibilityLabels[finalVisibility]}`,
      visibility: finalVisibility,
      isPublic: finalIsPublic,
      channelId: channelId,
      channelName: channelName
    };

  } catch (error) {
    console.error('Error updating channel visibility:', error);
    return {
      success: false,
      message: 'Failed to update channel visibility'
    };
  }
});
