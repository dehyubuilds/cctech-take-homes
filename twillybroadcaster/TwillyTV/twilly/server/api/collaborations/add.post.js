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
    const { channelName, collaboratorUsername, userEmail } = body;

    console.log('Add collaborator request:', { channelName, collaboratorUsername, userEmail });

    if (!channelName || !collaboratorUsername || !userEmail) {
      return {
        success: false,
        message: 'Missing required fields: channelName, collaboratorUsername, userEmail'
      };
    }

    // Verify user is channel owner (admin check)
    // For now, only dehyu.sinyan@gmail.com can add collaborators
    const ADMIN_EMAIL = 'dehyu.sinyan@gmail.com';
    if (userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return {
        success: false,
        message: 'Only the admin can add collaborators'
      };
    }

    // Verify channel exists
    // Channel ID format: email-channelName (e.g., "dehyu.sinyan@gmail.com-Twilly TV")
    // Try to find channel metadata
    const channelId = `${userEmail}-${channelName}`;
    const channelMetadataResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${channelId}`,
        SK: 'METADATA'
      }
    }).promise();

    if (!channelMetadataResult.Item) {
      // Try alternative channel ID format (just channelName)
      const channelMetadataResult2 = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelName}`,
          SK: 'METADATA'
        }
      }).promise();

      if (!channelMetadataResult2.Item) {
        // Try to find channel by scanning for channelName in METADATA
        const channelScan = await dynamodb.scan({
          TableName: table,
          FilterExpression: 'begins_with(PK, :pk) AND SK = :sk AND channelName = :channelName',
          ExpressionAttributeValues: {
            ':pk': 'CHANNEL#',
            ':sk': 'METADATA',
            ':channelName': channelName
          },
          Limit: 1
        }).promise();

        if (!channelScan.Items || channelScan.Items.length === 0) {
          return {
            success: false,
            message: `Channel '${channelName}' not found`
          };
        }
      }
    }

    // Look up collaborator user by username
    // Scan USER records for username match (PK = 'USER' where SK is userId, or PK = 'USER#email' where SK = 'PROFILE')
    // Note: DynamoDB scan with FilterExpression on username requires the username field to exist
    // We'll scan all USER records and filter in JavaScript for case-insensitive match
    let allUserItems = [];
    let lastEvaluatedKey = null;
    
    do {
      const scanParams = {
        TableName: table,
        FilterExpression: 'PK = :pk OR begins_with(PK, :pkPrefix)',
        ExpressionAttributeValues: {
          ':pk': 'USER',
          ':pkPrefix': 'USER#'
        },
        ExclusiveStartKey: lastEvaluatedKey
      };
      
      const scanResult = await dynamodb.scan(scanParams).promise();
      if (scanResult.Items) {
        allUserItems = allUserItems.concat(scanResult.Items);
      }
      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    // Filter in JavaScript for case-insensitive username match
    const matchingUsers = allUserItems.filter(item => {
      return item.username && item.username.toLowerCase() === collaboratorUsername.toLowerCase();
    });

    if (!matchingUsers || matchingUsers.length === 0) {
      return {
        success: false,
        message: `User with username '${collaboratorUsername}' not found`
      };
    }

    // Find the user record (prefer PK = 'USER' format where SK is userId)
    let collaboratorUser = matchingUsers.find(item => item.PK === 'USER');
    if (!collaboratorUser) {
      // Fallback to USER#email format
      collaboratorUser = matchingUsers.find(item => item.PK && item.PK.startsWith('USER#'));
    }
    if (!collaboratorUser) {
      collaboratorUser = matchingUsers[0]; // Last resort
    }

    // Extract userId and email based on PK format
    let collaboratorUserId;
    let collaboratorEmail;
    
    if (collaboratorUser.PK === 'USER') {
      // PK = 'USER', SK = userId
      collaboratorUserId = collaboratorUser.SK || collaboratorUser.userId;
      collaboratorEmail = collaboratorUser.email || collaboratorUser.userEmail;
    } else if (collaboratorUser.PK && collaboratorUser.PK.startsWith('USER#')) {
      // PK = 'USER#email', SK = 'PROFILE'
      collaboratorEmail = collaboratorUser.PK.replace('USER#', '') || collaboratorUser.email || collaboratorUser.userEmail;
      collaboratorUserId = collaboratorUser.userId || collaboratorUser.SK;
    } else {
      // Fallback
      collaboratorUserId = collaboratorUser.userId || collaboratorUser.SK;
      collaboratorEmail = collaboratorUser.email || collaboratorUser.userEmail || collaboratorUser.PK?.replace('USER#', '');
    }
    
    console.log('Found collaborator user:', {
      username: collaboratorUsername,
      userId: collaboratorUserId,
      email: collaboratorEmail,
      pk: collaboratorUser.PK,
      sk: collaboratorUser.SK
    });

    if (!collaboratorUserId || !collaboratorEmail) {
      return {
        success: false,
        message: 'Could not determine collaborator user ID or email'
      };
    }

    // Determine the correct channel ID (use the format we found in metadata lookup)
    let finalChannelId = channelId; // Default to email-channelName format
    if (!channelMetadataResult.Item) {
      // If we found it with alternative lookup, try to determine the correct ID
      const altChannelId = channelName;
      const altResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `CHANNEL#${altChannelId}`,
          SK: 'METADATA'
        }
      }).promise();
      if (altResult.Item) {
        finalChannelId = altChannelId;
      } else {
        // Scan to find the actual channel ID
        const channelScan = await dynamodb.scan({
          TableName: table,
          FilterExpression: 'begins_with(PK, :pk) AND SK = :sk AND channelName = :channelName',
          ExpressionAttributeValues: {
            ':pk': 'CHANNEL#',
            ':sk': 'METADATA',
            ':channelName': channelName
          },
          Limit: 1
        }).promise();
        if (channelScan.Items && channelScan.Items.length > 0) {
          finalChannelId = channelScan.Items[0].PK.replace('CHANNEL#', '');
        }
      }
    }

    // Check if already a collaborator (try both channel ID formats)
    const existingCollaborator1 = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${finalChannelId}`,
        SK: `COLLABORATOR#${collaboratorUserId}`
      }
    }).promise();

    const existingCollaborator2 = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${channelName}`,
        SK: `COLLABORATOR#${collaboratorUserId}`
      }
    }).promise();

    if (existingCollaborator1.Item || existingCollaborator2.Item) {
      return {
        success: false,
        message: 'User is already a collaborator of this channel'
      };
    }

    // Generate stream key for collaborator
    const streamKeyBase = `${channelName}_${collaboratorUserId}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    const streamKey = `sk_${streamKeyBase}${Math.random().toString(36).substring(2, 10)}`;

    // Create collaborator record on channel (use the correct channel ID format)
    const collaboratorRecord = {
      PK: `CHANNEL#${finalChannelId}`,
      SK: `COLLABORATOR#${collaboratorUserId}`,
      channelId: finalChannelId,
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
      SK: `COLLABORATOR_ROLE#${finalChannelId}`,
      channelId: finalChannelId,
      channelName: channelName,
      streamKey: streamKey,
      joinedAt: new Date().toISOString(),
      status: 'active',
      role: 'collaborator',
      channelOwnerEmail: ADMIN_EMAIL,
      // Explicitly mark as manually added (not via invite code)
      addedViaInvite: false
    };

    // Create stream key mapping
    const streamKeyMapping = {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING',
      streamKey: streamKey,
      ownerEmail: collaboratorEmail,
      seriesName: channelName,
      creatorId: collaboratorUserId,
      channelId: finalChannelId,
      isActive: true,
      isPersonalKey: false,
      isCollaboratorKey: true,
      createdAt: new Date().toISOString(),
      keyNumber: 1,
      status: 'ACTIVE'
    };

    // Save all records
    await Promise.all([
      dynamodb.put({ TableName: table, Item: collaboratorRecord }).promise(),
      dynamodb.put({ TableName: table, Item: userCollaboratorRecord }).promise(),
      dynamodb.put({ TableName: table, Item: streamKeyMapping }).promise()
    ]);

    console.log('✅ Collaborator added successfully');

    return {
      success: true,
      message: `Successfully added ${collaboratorUsername} as a collaborator to ${channelName}`,
      collaborator: {
        username: collaboratorUsername,
        email: collaboratorEmail,
        userId: collaboratorUserId,
        streamKey: streamKey
      }
    };

  } catch (error) {
    console.error('Error adding collaborator:', error);
    return {
      success: false,
      message: `Failed to add collaborator: ${error.message}`
    };
  }
});
