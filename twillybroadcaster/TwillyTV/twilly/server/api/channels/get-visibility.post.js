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
    const { channelId, channelName, creatorUsername } = body;

    console.log('Getting channel visibility:', { channelId, channelName, creatorUsername });

    // Get channel metadata
    const channelResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${channelId}`,
        SK: 'METADATA'
      }
    }).promise();

    if (channelResult.Item) {
      // Support both new visibility string and old isPublic boolean
      let visibility = channelResult.Item.visibility;
      const isPublic = channelResult.Item.isPublic || false;
      
      // Migrate old boolean to new format if needed
      if (!visibility) {
        visibility = isPublic ? 'public' : 'private';
      }
      
      console.log('Channel visibility found:', { visibility, isPublic });
      
      return {
        success: true,
        visibility: visibility,
        isPublic: isPublic, // Keep for backward compatibility
        channelId: channelId,
        channelName: channelName
      };
    } else {
      // If no channel metadata exists, default to private
      console.log('No channel metadata found, defaulting to private');
      return {
        success: true,
        visibility: 'private',
        isPublic: false,
        channelId: channelId,
        channelName: channelName
      };
    }

  } catch (error) {
    console.error('Error getting channel visibility:', error);
    return {
      success: false,
      message: 'Failed to get channel visibility',
      isPublic: false
    };
  }
});
