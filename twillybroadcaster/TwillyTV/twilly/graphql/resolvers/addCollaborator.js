import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

/**
 * GraphQL Resolver: addCollaborator
 * Adds a collaborator to a channel by username and sends notification
 * Only channel owner can add collaborators
 */
export const addCollaborator = async (args, context) => {
  try {
    const { channelName, collaboratorUsername } = args;
    const { userEmail, userId } = context; // From authentication context

    if (!channelName || !collaboratorUsername) {
      return {
        success: false,
        message: 'Missing required fields: channelName and collaboratorUsername',
        collaborator: null,
        notificationSent: false
      };
    }

    // Verify user is channel owner
    const channelOwnerResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${channelName}`,
        SK: 'OWNER'
      }
    }).promise();

    if (!channelOwnerResult.Item) {
      return {
        success: false,
        message: 'Channel not found',
        collaborator: null,
        notificationSent: false
      };
    }

    const ownerEmail = channelOwnerResult.Item.email || channelOwnerResult.Item.userEmail;
    if (ownerEmail !== userEmail) {
      return {
        success: false,
        message: 'Only channel owner can add collaborators',
        collaborator: null,
        notificationSent: false
      };
    }

    // Look up collaborator user by username
    const userQueryResult = await dynamodb.query({
      TableName: table,
      IndexName: 'UsernameIndex', // Assuming username GSI exists
      KeyConditionExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': collaboratorUsername
      }
    }).promise();

    // Fallback: query USER records
    let collaboratorUser = null;
    if (!userQueryResult.Items || userQueryResult.Items.length === 0) {
      // Scan USER records for username match
      const scanResult = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'SK = :sk AND username = :username',
        ExpressionAttributeValues: {
          ':sk': 'PROFILE',
          ':username': collaboratorUsername
        }
      }).promise();

      if (scanResult.Items && scanResult.Items.length > 0) {
        collaboratorUser = scanResult.Items[0];
      }
    } else {
      collaboratorUser = userQueryResult.Items[0];
    }

    if (!collaboratorUser) {
      return {
        success: false,
        message: `User with username '${collaboratorUsername}' not found`,
        collaborator: null,
        notificationSent: false
      };
    }

    const collaboratorUserId = collaboratorUser.userId || collaboratorUser.PK?.replace('USER#', '');
    const collaboratorEmail = collaboratorUser.email || collaboratorUser.userEmail || collaboratorUser.PK?.replace('USER#', '');

    if (!collaboratorUserId || !collaboratorEmail) {
      return {
        success: false,
        message: 'Could not determine collaborator user ID or email',
        collaborator: null,
        notificationSent: false
      };
    }

    // Check if collaborator already exists
    const existingCollaboratorResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${channelName}`,
        SK: `COLLABORATOR#${collaboratorUserId}`
      }
    }).promise();

    if (existingCollaboratorResult.Item && existingCollaboratorResult.Item.status === 'active') {
      return {
        success: false,
        message: 'User is already a collaborator on this channel',
        collaborator: null,
        notificationSent: false
      };
    }

    // Generate stream key for collaborator
    const streamKeyBase = `${channelName}_${collaboratorUserId}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    const streamKey = `sk_${streamKeyBase}${Math.random().toString(36).substring(2, 10)}`;

    // Create collaborator record on channel
    const collaboratorRecord = {
      PK: `CHANNEL#${channelName}`,
      SK: `COLLABORATOR#${collaboratorUserId}`,
      channelId: channelName,
      channelName: channelName,
      userId: collaboratorUserId,
      userEmail: collaboratorEmail,
      username: collaboratorUsername,
      streamKey: streamKey,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'collaborator',
      addedBy: userEmail,
      addedAt: new Date().toISOString()
    };

    // Create user's collaborator role record
    const userCollaboratorRecord = {
      PK: `USER#${collaboratorUserId}`,
      SK: `COLLABORATOR_ROLE#${channelName}`,
      channelId: channelName,
      channelName: channelName,
      streamKey: streamKey,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'collaborator',
      channelOwnerEmail: ownerEmail
    };

    // Save both records
    await Promise.all([
      dynamodb.put({ TableName: table, Item: collaboratorRecord }).promise(),
      dynamodb.put({ TableName: table, Item: userCollaboratorRecord }).promise()
    ]);

    // Create notification for collaborator
    const notification = {
      PK: `USER#${collaboratorUserId}`,
      SK: `NOTIFICATION#${Date.now()}`,
      notificationId: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId: collaboratorUserId,
      channelName: channelName,
      channelOwnerEmail: ownerEmail,
      message: `You've been added as a collaborator to channel "${channelName}". You can now stream and manage this channel!`,
      type: 'collaborator_added',
      createdAt: new Date().toISOString(),
      read: false
    };

    let notificationSent = false;
    try {
      await dynamodb.put({ TableName: table, Item: notification }).promise();
      notificationSent = true;
      console.log(`✅ Notification created for collaborator: ${collaboratorUserId}`);
    } catch (notifError) {
      console.error('Error creating notification:', notifError);
      // Don't fail the whole operation if notification fails
    }

    return {
      success: true,
      message: `Successfully added ${collaboratorUsername} as collaborator to ${channelName}`,
      collaborator: {
        userId: collaboratorUserId,
        userEmail: collaboratorEmail,
        username: collaboratorUsername,
        channelName: channelName,
        role: 'collaborator',
        joinedAt: collaboratorRecord.joinedAt,
        status: 'active'
      },
      notificationSent
    };

  } catch (error) {
    console.error('Error in addCollaborator resolver:', error);
    return {
      success: false,
      message: `Failed to add collaborator: ${error.message}`,
      collaborator: null,
      notificationSent: false
    };
  }
};
