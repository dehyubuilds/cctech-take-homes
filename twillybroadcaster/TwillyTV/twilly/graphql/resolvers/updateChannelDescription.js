import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

/**
 * GraphQL Resolver: updateChannelDescription
 * Updates channel description - available to channel owner and collaborators
 */
export const updateChannelDescription = async (args, context) => {
  try {
    const { channelName, description } = args;
    const { userEmail, userId } = context;

    if (!channelName || !description || description.trim().length === 0) {
      return {
        success: false,
        message: 'Missing required fields: channelName and description',
        channel: null
      };
    }

    // Check if user is channel owner or collaborator
    const isOwner = await checkChannelOwner(channelName, userEmail);
    const isCollaborator = await checkChannelCollaborator(channelName, userId);

    if (!isOwner && !isCollaborator) {
      return {
        success: false,
        message: 'Only channel owner or collaborators can update channel description',
        channel: null
      };
    }

    // Find channel record (could be SERIES# or CHANNEL#)
    let channelRecord = null;
    let channelKey = null;

    // Try CHANNEL# first
    const channelResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${channelName}`,
        SK: 'OWNER'
      }
    }).promise();

    if (channelResult.Item) {
      channelRecord = channelResult.Item;
      channelKey = {
        PK: `CHANNEL#${channelName}`,
        SK: 'OWNER'
      };
    } else {
      // Try SERIES# format
      const creatorEmail = isOwner ? userEmail : channelRecord?.creatorEmail;
      if (creatorEmail) {
        const seriesQuery = await dynamodb.query({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          FilterExpression: 'seriesName = :seriesName',
          ExpressionAttributeValues: {
            ':pk': `CREATOR#${creatorEmail}`,
            ':sk': 'SERIES#',
            ':seriesName': channelName
          }
        }).promise();

        if (seriesQuery.Items && seriesQuery.Items.length > 0) {
          const seriesId = seriesQuery.Items[0].seriesId;
          const seriesResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `SERIES#${seriesId}`,
              SK: 'METADATA'
            }
          }).promise();

          if (seriesResult.Item) {
            channelRecord = seriesResult.Item;
            channelKey = {
              PK: `SERIES#${seriesId}`,
              SK: 'METADATA'
            };
          }
        }
      }
    }

    if (!channelRecord || !channelKey) {
      return {
        success: false,
        message: 'Channel not found',
        channel: null
      };
    }

    // Update description
    const updateResult = await dynamodb.update({
      TableName: table,
      Key: channelKey,
      UpdateExpression: 'SET description = :description, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':description': description.trim(),
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    }).promise();

    return {
      success: true,
      message: 'Channel description updated successfully',
      channel: {
        channelId: channelName,
        channelName: channelName,
        description: description.trim(),
        updatedAt: updateResult.Attributes.updatedAt
      }
    };

  } catch (error) {
    console.error('Error in updateChannelDescription resolver:', error);
    return {
      success: false,
      message: `Failed to update channel description: ${error.message}`,
      channel: null
    };
  }
};

// Helper functions
async function checkChannelOwner(channelName, userEmail) {
  try {
    const result = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${channelName}`,
        SK: 'OWNER'
      }
    }).promise();

    if (result.Item) {
      const ownerEmail = result.Item.email || result.Item.userEmail;
      return ownerEmail === userEmail;
    }
    return false;
  } catch (error) {
    console.error('Error checking channel owner:', error);
    return false;
  }
}

async function checkChannelCollaborator(channelName, userId) {
  if (!userId) return false;
  
  try {
    const result = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${channelName}`,
        SK: `COLLABORATOR#${userId}`
      }
    }).promise();

    return result.Item && result.Item.status === 'active';
  } catch (error) {
    console.error('Error checking channel collaborator:', error);
    return false;
  }
}
