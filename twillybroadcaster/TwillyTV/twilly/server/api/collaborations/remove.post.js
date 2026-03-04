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

    console.log('Remove collaborator request:', { channelName, collaboratorUsername, userEmail });

    if (!channelName || !collaboratorUsername || !userEmail) {
      return {
        success: false,
        message: 'Missing required fields: channelName, collaboratorUsername, userEmail'
      };
    }

    // Verify user is admin (only admin can remove collaborators)
    const ADMIN_EMAIL = 'dehyu.sinyan@gmail.com';
    if (userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return {
        success: false,
        message: 'Only the admin can remove collaborators'
      };
    }

    // Find collaborator user by username
    const scanResult = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'SK = :sk AND username = :username',
      ExpressionAttributeValues: {
        ':sk': 'PROFILE',
        ':username': collaboratorUsername
      },
      Limit: 1
    }).promise();

    if (!scanResult.Items || scanResult.Items.length === 0) {
      return {
        success: false,
        message: `User with username '${collaboratorUsername}' not found`
      };
    }

    const collaboratorUser = scanResult.Items[0];
    const collaboratorUserId = collaboratorUser.userId || collaboratorUser.PK?.replace('USER#', '');

    if (!collaboratorUserId) {
      return {
        success: false,
        message: 'Could not determine collaborator user ID'
      };
    }

    // Determine the correct channel ID first (same logic as list.post.js and add.post.js)
    let finalChannelId = null;
    
    // Strategy 1: Try email-channelName format first
    const channelId = `${userEmail}-${channelName}`;
    const channelMetadataResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${channelId}`,
        SK: 'METADATA'
      }
    }).promise();
    
    if (channelMetadataResult.Item) {
      finalChannelId = channelId;
      console.log(`✅ Found channel metadata with email-channelName format: ${channelId}`);
    } else {
      // Strategy 2: Try just channelName format
      const channelMetadataResult2 = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelName}`,
          SK: 'METADATA'
        }
      }).promise();
      
      if (channelMetadataResult2.Item) {
        finalChannelId = channelName;
        console.log(`✅ Found channel metadata with channelName format: ${channelName}`);
      } else {
        // Strategy 3: Scan for channelName in METADATA to find the correct channel ID
        console.log(`Scanning for channel metadata with channelName: ${channelName}`);
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
          console.log(`✅ Found channel metadata via scan, using actualChannelId: ${finalChannelId}`);
        } else {
          console.log(`⚠️ Channel '${channelName}' not found in metadata`);
        }
      }
    }
    
    if (!finalChannelId) {
      return {
        success: false,
        message: `Channel '${channelName}' not found`
      };
    }

    // Get collaborator record to find stream key (try both channel ID formats)
    let collaboratorRecord = null;
    let streamKey = null;
    
    // Try with finalChannelId first
    const collaboratorRecord1 = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CHANNEL#${finalChannelId}`,
        SK: `COLLABORATOR#${collaboratorUserId}`
      }
    }).promise();
    
    if (collaboratorRecord1.Item) {
      collaboratorRecord = collaboratorRecord1.Item;
      streamKey = collaboratorRecord.streamKey;
      console.log(`✅ Found collaborator record with channelId: ${finalChannelId}`);
    } else {
      // Try with channelName as fallback
      const collaboratorRecord2 = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelName}`,
          SK: `COLLABORATOR#${collaboratorUserId}`
        }
      }).promise();
      
      if (collaboratorRecord2.Item) {
        collaboratorRecord = collaboratorRecord2.Item;
        streamKey = collaboratorRecord.streamKey;
        finalChannelId = channelName; // Update to use channelName format
        console.log(`✅ Found collaborator record with channelName: ${channelName}`);
      }
    }

    if (!collaboratorRecord) {
      return {
        success: false,
        message: 'Collaborator not found for this channel'
      };
    }

    // Delete all collaborator-related records
    const deletePromises = [
      // Delete channel collaborator record (try both formats)
      dynamodb.delete({
        TableName: table,
        Key: {
          PK: `CHANNEL#${finalChannelId}`,
          SK: `COLLABORATOR#${collaboratorUserId}`
        }
      }).promise(),
      
      // Delete user collaborator role record (try both channel ID formats)
      dynamodb.delete({
        TableName: table,
        Key: {
          PK: `USER#${collaboratorUserId}`,
          SK: `COLLABORATOR_ROLE#${finalChannelId}`
        }
      }).promise()
    ];
    
    // Also try deleting with channelName format (in case it was stored differently)
    if (finalChannelId !== channelName) {
      deletePromises.push(
        dynamodb.delete({
          TableName: table,
          Key: {
            PK: `USER#${collaboratorUserId}`,
            SK: `COLLABORATOR_ROLE#${channelName}`
          }
        }).promise()
      );
    }

    // If stream key exists, also delete stream key mapping
    if (streamKey) {
      deletePromises.push(
        dynamodb.delete({
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${streamKey}`,
            SK: 'MAPPING'
          }
        }).promise()
      );
    }

    await Promise.all(deletePromises);

    console.log('✅ Collaborator removed successfully');

    return {
      success: true,
      message: `Successfully removed ${collaboratorUsername} as a collaborator from ${channelName}`
    };

  } catch (error) {
    console.error('Error removing collaborator:', error);
    return {
      success: false,
      message: `Failed to remove collaborator: ${error.message}`
    };
  }
});
