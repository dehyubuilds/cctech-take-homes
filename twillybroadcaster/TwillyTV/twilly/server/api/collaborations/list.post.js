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
    const { channelName, userEmail } = body;

    console.log('List collaborators request:', { channelName, userEmail });

    if (!channelName || !userEmail) {
      return {
        success: false,
        message: 'Missing required fields: channelName, userEmail',
        collaborators: []
      };
    }

    // Verify user is admin (only admin can list collaborators)
    const ADMIN_EMAIL = 'dehyu.sinyan@gmail.com';
    if (userEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return {
        success: false,
        message: 'Only the admin can list collaborators',
        collaborators: []
      };
    }

    // Determine the correct channel ID first (same logic as add.post.js)
    // This ensures we use the same channel ID format that was used when adding collaborators
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
      console.log(`⚠️ Could not determine channel ID for '${channelName}', returning empty list`);
      return {
        success: true,
        message: `Channel '${channelName}' not found`,
        collaborators: [],
        count: 0
      };
    }
    
    // Now query collaborators using the determined channel ID
    console.log(`🔍 Querying collaborators with PK: CHANNEL#${finalChannelId}`);
    let collaborators = [];
    
    try {
      const queryParams = {
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `CHANNEL#${finalChannelId}`,
          ':sk': 'COLLABORATOR#'
        }
      };
      const result = await dynamodb.query(queryParams).promise();
      collaborators = result.Items || [];
      console.log(`✅ Found ${collaborators.length} collaborators for channel: ${channelName} (channelId: ${finalChannelId})`);
      
      if (collaborators.length > 0) {
        console.log('Sample collaborators:');
        collaborators.forEach((collab, index) => {
          console.log(`  [${index + 1}] username: ${collab.username || 'MISSING'}, userId: ${collab.userId || 'MISSING'}, email: ${collab.userEmail || collab.email || 'MISSING'}`);
        });
      }
    } catch (err) {
      console.error(`❌ Error querying collaborators for CHANNEL#${finalChannelId}:`, err);
    }

    // Format collaborators - ensure all required fields are present
    // First, look up missing usernames from user profiles
    const formattedCollaborators = await Promise.all(collaborators.map(async (collab) => {
      const userId = collab.userId || collab.SK?.replace('COLLABORATOR#', '');
      const userEmail = collab.userEmail || collab.email;
      let username = collab.username;
      
      // If username is missing, try to look it up from user profile
      if (!username && userId) {
        try {
          // Try to find user profile by userId
          const userProfileQuery = await dynamodb.query({
            TableName: table,
            KeyConditionExpression: 'PK = :pk AND SK = :sk',
            ExpressionAttributeValues: {
              ':pk': 'USER',
              ':sk': userId
            },
            Limit: 1
          }).promise();
          
          if (userProfileQuery.Items && userProfileQuery.Items.length > 0) {
            username = userProfileQuery.Items[0].username;
            console.log(`✅ Found username '${username}' for userId: ${userId}`);
          } else {
            // Try USER#email format
            if (userEmail) {
              const userProfileGet = await dynamodb.get({
                TableName: table,
                Key: {
                  PK: `USER#${userEmail}`,
                  SK: 'PROFILE'
                }
              }).promise();
              
              if (userProfileGet.Item && userProfileGet.Item.username) {
                username = userProfileGet.Item.username;
                console.log(`✅ Found username '${username}' for email: ${userEmail}`);
              }
            }
          }
        } catch (err) {
          console.error(`⚠️ Error looking up username for userId ${userId}:`, err);
        }
      }
      
      const formatted = {
        userId: userId,
        userEmail: userEmail,
        username: username || 'Unknown', // Default to 'Unknown' if username is still missing
        streamKey: collab.streamKey,
        joinedAt: collab.joinedAt,
        status: collab.status || 'active',
        role: collab.role || 'collaborator',
        addedBy: collab.addedBy,
        addedAt: collab.addedAt
      };
      
      // Validate required fields (userId and userEmail are required, username is optional)
      if (!formatted.userId || !formatted.userEmail) {
        console.warn('⚠️ Collaborator missing required fields (userId or userEmail):', {
          userId: formatted.userId,
          userEmail: formatted.userEmail,
          username: formatted.username,
          pk: collab.PK,
          sk: collab.SK
        });
      }
      
      return formatted;
    }));
    
    // Filter out invalid entries and also filter out the admin (they're the owner, not a collaborator)
    // ADMIN_EMAIL is already declared at the top of the function
    const validCollaborators = formattedCollaborators.filter(collab => {
      // Filter out if missing userId or userEmail
      if (!collab.userId || !collab.userEmail) {
        return false;
      }
      // Filter out the admin (they're the channel owner, not a collaborator)
      if (collab.userEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        console.log(`ℹ️ Filtering out admin (${collab.userEmail}) from collaborator list - they're the owner`);
        return false;
      }
      return true;
    });

    console.log(`Returning ${validCollaborators.length} formatted collaborators (filtered from ${formattedCollaborators.length} total)`);

    return {
      success: true,
      message: 'Collaborators retrieved successfully',
      collaborators: validCollaborators,
      count: validCollaborators.length
    };

  } catch (error) {
    console.error('Error in list collaborators:', error);
    return {
      success: false,
      message: 'Failed to retrieve collaborators',
      collaborators: []
    };
  }
});
