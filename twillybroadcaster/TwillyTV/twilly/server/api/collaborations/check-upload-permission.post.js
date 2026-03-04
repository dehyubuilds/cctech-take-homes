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
    const { userEmail, userId, channelName } = body;

    console.log('Checking upload permission:', { userEmail, userId, channelName });

    if (!userEmail || !channelName) {
      return {
        success: false,
        canUpload: false,
        message: 'Missing required fields: userEmail and channelName'
      };
    }

    // Check if user is the channel owner
    // Channel owner records are stored as CHANNEL#channelName with SK: OWNER
    try {
      const ownerResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelName}`,
          SK: 'OWNER'
        }
      }).promise();

      if (ownerResult.Item) {
        const ownerEmail = ownerResult.Item.email || ownerResult.Item.userEmail || ownerResult.Item.userId;
        if (ownerEmail === userEmail) {
          console.log('✅ User is channel owner');
          return {
            success: true,
            canUpload: true,
            isOwner: true,
            isCollaborator: false,
            message: 'User is channel owner'
          };
        }
      }
    } catch (error) {
      console.error('Error checking channel owner:', error);
    }

    // Check if user is a collaborator
    // Collaborator records are stored as CHANNEL#channelName with SK: COLLABORATOR#userId
    // Also check USER#userId with SK: COLLABORATOR_ROLE#channelName
    try {
      // First check: CHANNEL#channelName -> COLLABORATOR#userId
      if (userId) {
        const collaboratorResult = await dynamodb.get({
          TableName: table,
          Key: {
            PK: `CHANNEL#${channelName}`,
            SK: `COLLABORATOR#${userId}`
          }
        }).promise();

        if (collaboratorResult.Item && collaboratorResult.Item.status === 'active') {
          console.log('✅ User is active collaborator');
          return {
            success: true,
            canUpload: true,
            isOwner: false,
            isCollaborator: true,
            message: 'User is active collaborator'
          };
        }
      }

      // Second check: USER#userId -> COLLABORATOR_ROLE#channelName
      if (userId) {
        const userCollaboratorResult = await dynamodb.get({
          TableName: table,
          Key: {
            PK: `USER#${userId}`,
            SK: `COLLABORATOR_ROLE#${channelName}`
          }
        }).promise();

        if (userCollaboratorResult.Item && userCollaboratorResult.Item.status === 'active') {
          console.log('✅ User is active collaborator (via user record)');
          return {
            success: true,
            canUpload: true,
            isOwner: false,
            isCollaborator: true,
            message: 'User is active collaborator'
          };
        }
      }

      // Fallback: Check by email in collaborator records
      const queryResult = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `CHANNEL#${channelName}`,
          ':sk': 'COLLABORATOR#'
        }
      }).promise();

      const matchingCollaborator = queryResult.Items?.find(item => 
        (item.userEmail === userEmail || item.email === userEmail) && 
        item.status === 'active'
      );

      if (matchingCollaborator) {
        console.log('✅ User is active collaborator (via email match)');
        return {
          success: true,
          canUpload: true,
          isOwner: false,
          isCollaborator: true,
          message: 'User is active collaborator'
        };
      }
    } catch (error) {
      console.error('Error checking collaborator status:', error);
    }

    // User is neither owner nor collaborator
    console.log('❌ User cannot upload - not owner or collaborator');
    return {
      success: true,
      canUpload: false,
      isOwner: false,
      isCollaborator: false,
      message: 'User is not authorized to upload to this channel'
    };

  } catch (error) {
    console.error('Error checking upload permission:', error);
    return {
      success: false,
      canUpload: false,
      message: `Error checking permission: ${error.message}`
    };
  }
});
