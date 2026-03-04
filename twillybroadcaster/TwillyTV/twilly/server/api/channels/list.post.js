import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials for deployment compatibility
  AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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',
    region: 'us-east-1'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const table = 'Twilly';

  try {
    const body = await readBody(event);
    const { userEmail } = body;

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: userEmail'
      });
    }

    // Get all folders (channels) for the user
    const categories = ['Mixed', 'Videos', 'Images', 'Audios', 'Docs'];
    const channels = [];

    for (const category of categories) {
      const queryParams = {
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userEmail}`,
          ':skPrefix': `FOLDER#${category}#`
        }
      };

      try {
        const result = await dynamodb.query(queryParams).promise();
        
        if (result.Items && result.Items.length > 0) {
          for (const folder of result.Items) {
            // Extract channel name from SK (format: FOLDER#CATEGORY#CHANNEL_NAME)
            const channelName = folder.SK.split('#').slice(2).join('#');
            
            // Skip default and thumbnails folders
            if (channelName === 'default' || channelName === 'thumbnails') {
              continue;
            }

            // Check if channel already added (avoid duplicates across categories)
            if (channels.find(c => c.name === channelName)) {
              continue;
            }

            // Check for existing stream key for this channel
            const streamKeyQuery = {
              TableName: table,
              FilterExpression: 'begins_with(PK, :pkPrefix) AND ownerEmail = :userEmail AND seriesName = :channelName AND isCollaboratorKey <> :isCollaboratorKey',
              ExpressionAttributeValues: {
                ':pkPrefix': 'STREAM_KEY#',
                ':userEmail': userEmail,
                ':channelName': channelName,
                ':isCollaboratorKey': true
              }
            };

            const streamKeyResult = await dynamodb.scan(streamKeyQuery).promise();
            const hasStreamKey = streamKeyResult.Items && streamKeyResult.Items.length > 0;
            const streamKey = hasStreamKey ? streamKeyResult.Items[0].streamKey : null;

            // Get username for share URL
            let username = null;
            try {
              const userQuery = {
                TableName: table,
                FilterExpression: 'PK = :pk AND email = :email',
                ExpressionAttributeValues: {
                  ':pk': 'USER',
                  ':email': userEmail
                },
                Limit: 1
              };
              const userResult = await dynamodb.scan(userQuery).promise();
              if (userResult.Items && userResult.Items.length > 0) {
                username = userResult.Items[0].username || null;
              }
            } catch (err) {
              console.error('Error fetching username:', err);
            }

            // Build share URL
            let shareUrl = null;
            if (username) {
              const slug = channelName.toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
              shareUrl = `https://twilly.app/c/${username}/${slug}`;
            } else {
              // Fallback to menu/share format
              const slug = channelName.toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '');
              shareUrl = `https://twilly.app/menu/share/${encodeURIComponent(userEmail)}/${encodeURIComponent(channelName)}`;
            }

            // Get channel visibility from METADATA record
            // Try to find channel by seriesName or channelName in CHANNEL# records
            let visibility = 'private';
            let isPublic = false;
            
            try {
              // Channel ID format: email-channelName (exact format used in DynamoDB)
              const channelId = `${userEmail}-${channelName}`;
              
              console.log(`Looking up visibility for channel: ${channelName}, channelId: ${channelId}`);
              
              // First try direct lookup with CHANNEL# format
              try {
                const metadataResult = await dynamodb.get({
                  TableName: table,
                  Key: {
                    PK: `CHANNEL#${channelId}`,
                    SK: 'METADATA'
                  }
                }).promise();
                
                if (metadataResult.Item) {
                  console.log(`Found CHANNEL# metadata for ${channelName}:`, {
                    visibility: metadataResult.Item.visibility,
                    isPublic: metadataResult.Item.isPublic
                  });
                  
                  if (metadataResult.Item.visibility) {
                    visibility = metadataResult.Item.visibility;
                    isPublic = (visibility === 'public');
                  } else if (metadataResult.Item.isPublic === true) {
                    visibility = 'public';
                    isPublic = true;
                  } else if (metadataResult.Item.isPublic === false) {
                    visibility = 'private';
                    isPublic = false;
                  }
                } else {
                  console.log(`No CHANNEL# metadata found for ${channelName}, trying SERIES# format`);
                  
                  // Try SERIES# format (for older channels)
                  const seriesScan = await dynamodb.scan({
                    TableName: table,
                    FilterExpression: 'begins_with(PK, :pk) AND SK = :sk AND (seriesName = :name OR channelName = :name)',
                    ExpressionAttributeValues: {
                      ':pk': 'SERIES#',
                      ':sk': 'METADATA',
                      ':name': channelName
                    },
                    Limit: 1
                  }).promise();
                  
                  if (seriesScan.Items && seriesScan.Items.length > 0) {
                    const seriesItem = seriesScan.Items[0];
                    console.log(`Found SERIES# metadata for ${channelName}:`, {
                      visibility: seriesItem.visibility,
                      isPublic: seriesItem.isPublic
                    });
                    
                    if (seriesItem.visibility) {
                      visibility = seriesItem.visibility;
                      isPublic = (visibility === 'public');
                    } else if (seriesItem.isPublic === true) {
                      visibility = 'public';
                      isPublic = true;
                    }
                  } else {
                    console.log(`No metadata found for ${channelName}, defaulting to private`);
                  }
                }
              } catch (getErr) {
                console.error(`Error getting metadata for ${channelName}:`, getErr);
                
                // Fallback: Scan for CHANNEL# records matching this channelName
                try {
                  const channelScan = await dynamodb.scan({
                    TableName: table,
                    FilterExpression: 'begins_with(PK, :pk) AND SK = :sk AND channelName = :name',
                    ExpressionAttributeValues: {
                      ':pk': 'CHANNEL#',
                      ':sk': 'METADATA',
                      ':name': channelName
                    },
                    Limit: 1
                  }).promise();
                  
                  if (channelScan.Items && channelScan.Items.length > 0) {
                    const channelItem = channelScan.Items[0];
                    console.log(`Found CHANNEL# metadata via scan for ${channelName}:`, {
                      visibility: channelItem.visibility,
                      isPublic: channelItem.isPublic,
                      pk: channelItem.PK
                    });
                    
                    if (channelItem.visibility) {
                      visibility = channelItem.visibility;
                      isPublic = (visibility === 'public');
                    } else if (channelItem.isPublic === true) {
                      visibility = 'public';
                      isPublic = true;
                    }
                  } else {
                    // Try SERIES# format as final fallback
                    try {
                      const seriesScan = await dynamodb.scan({
                        TableName: table,
                        FilterExpression: 'begins_with(PK, :pk) AND SK = :sk AND (seriesName = :name OR channelName = :name)',
                        ExpressionAttributeValues: {
                          ':pk': 'SERIES#',
                          ':sk': 'METADATA',
                          ':name': channelName
                        },
                        Limit: 1
                      }).promise();
                      
                      if (seriesScan.Items && seriesScan.Items.length > 0) {
                        const seriesItem = seriesScan.Items[0];
                        if (seriesItem.visibility) {
                          visibility = seriesItem.visibility;
                          isPublic = (visibility === 'public');
                        } else if (seriesItem.isPublic === true) {
                          visibility = 'public';
                          isPublic = true;
                        }
                      }
                    } catch (scanErr) {
                      console.error(`Error scanning SERIES# for ${channelName}:`, scanErr);
                    }
                  }
                } catch (scanErr) {
                  console.error(`Error scanning CHANNEL# for ${channelName}:`, scanErr);
                }
              }
            } catch (err) {
              console.error(`Error fetching visibility for channel ${channelName}:`, err);
              // Default to private if we can't determine
            }
            
            console.log(`Final visibility for ${channelName}: ${visibility} (isPublic: ${isPublic})`);

            channels.push({
              id: `${userEmail}_${channelName}`,
              name: channelName,
              shareUrl: shareUrl,
              streamKey: streamKey,
              hasStreamKey: hasStreamKey,
              visibility: visibility,
              isPublic: isPublic
            });
          }
        }
      } catch (err) {
        console.error(`Error querying ${category} folders:`, err);
        // Continue with other categories
      }
    }

    return {
      success: true,
      channels: channels
    };

  } catch (error) {
    console.error('Error listing channels:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to list channels'
    });
  }
});

