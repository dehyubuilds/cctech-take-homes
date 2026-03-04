import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

// Use hardcoded credentials for production compatibility (SOC2 note: replace with IAM role in runtime)
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default defineEventHandler(async (event) => {
  console.log('🔍 [get-or-create-stream-key] Endpoint called');
  console.log('🔍 [get-or-create-stream-key] Request method:', event.method);
  console.log('🔍 [get-or-create-stream-key] Request URL:', event.node.req.url);
  
  try {
    const body = await readBody(event);
    console.log('🔍 [get-or-create-stream-key] Request body received:', JSON.stringify(body, null, 2));
    
    const { channelId, channelName, userId, userEmail } = body;

    console.log('🔍 [get-or-create-stream-key] Parsed parameters:', { 
      channelId, 
      channelName, 
      userId, 
      userEmail,
      hasChannelId: !!channelId,
      hasChannelName: !!channelName,
      hasUserId: !!userId,
      hasUserEmail: !!userEmail
    });

    // Validate required fields
    if (!channelId || !channelName || !userId || !userEmail) {
      console.error('❌ [get-or-create-stream-key] Missing required fields:', {
        channelId: !!channelId,
        channelName: !!channelName,
        userId: !!userId,
        userEmail: !!userEmail
      });
      return {
        success: false,
        message: 'Missing required fields: channelId, channelName, userId, userEmail'
      };
    }
    
    console.log('✅ [get-or-create-stream-key] All required fields present, proceeding...');

    // First, check if channel is public - if so, everyone is a collaborator
    let isPublicChannel = false;
    let channelCreatorEmail = null;
    try {
      const channelMetadataResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelId}`,
          SK: 'METADATA'
        }
      }).promise();

      if (channelMetadataResult.Item) {
        // Check both new visibility field and old isPublic boolean
        const visibility = channelMetadataResult.Item.visibility;
        const isPublic = channelMetadataResult.Item.isPublic;
        isPublicChannel = (visibility === 'public') || (isPublic === true);
        // Get creator email from metadata
        channelCreatorEmail = channelMetadataResult.Item.creatorEmail || channelMetadataResult.Item.userEmail;
        console.log('🔍 [get-or-create-stream-key] Channel visibility check:', { 
          channelId, 
          visibility, 
          isPublic, 
          isPublicChannel,
          channelCreatorEmail,
          metadataItem: channelMetadataResult.Item
        });
      } else {
        console.log('⚠️ [get-or-create-stream-key] No channel metadata found for:', channelId);
        // Fallback: try to extract email from channelId (format: {email}-{channelName})
        const lastDashIndex = channelId.lastIndexOf('-');
        if (lastDashIndex > 0) {
          channelCreatorEmail = channelId.substring(0, lastDashIndex);
          console.log('⚠️ [get-or-create-stream-key] Extracted creator email from channelId:', channelCreatorEmail);
        }
      }
    } catch (error) {
      console.error('❌ [get-or-create-stream-key] Error checking channel visibility:', error);
      console.error('   Error details:', error.message, error.stack);
      // Fallback: try to extract email from channelId
      const lastDashIndex = channelId.lastIndexOf('-');
      if (lastDashIndex > 0) {
        channelCreatorEmail = channelId.substring(0, lastDashIndex);
        console.log('⚠️ [get-or-create-stream-key] Extracted creator email from channelId (fallback):', channelCreatorEmail);
      }
      // Continue with normal flow if we can't check visibility
    }

    // Check if user already has a collaborator key for this channel
    try {
      const collaborationResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelId}`,
          SK: `COLLABORATOR#${userId}`
        }
      }).promise();

      if (collaborationResult.Item && collaborationResult.Item.streamKey) {
        // User already has a collaborator key
        console.log('✅ [get-or-create-stream-key] Found existing collaborator key:', {
          userId,
          channelId,
          streamKey: collaborationResult.Item.streamKey,
          collaborationItem: collaborationResult.Item
        });
        return {
          success: true,
          streamKey: collaborationResult.Item.streamKey,
          isNew: false,
          message: 'Stream key retrieved successfully'
        };
      } else {
        console.log('🔍 [get-or-create-stream-key] No existing collaboration found:', {
          userId,
          channelId,
          hasItem: !!collaborationResult.Item,
          hasStreamKey: !!(collaborationResult.Item?.streamKey)
        });
      }
    } catch (error) {
      console.error('❌ [get-or-create-stream-key] Error checking existing collaboration:', error);
      console.error('   Error details:', error.message, error.stack);
    }

    // Check if user is the channel owner
    const isChannelOwner = channelCreatorEmail && userEmail === channelCreatorEmail;
    
    console.log('🔍 [get-or-create-stream-key] Channel ownership check:', {
      channelId,
      channelCreatorEmail,
      userEmail,
      isChannelOwner
    });

    // If channel is public, treat everyone as a collaborator - create collaboration automatically
    if (isPublicChannel) {
      console.log('✅ [get-or-create-stream-key] Channel is PUBLIC - allowing access for any user');
    } else if (isChannelOwner) {
      // Channel owner always has access
      console.log('✅ [get-or-create-stream-key] User is the channel owner - allowing access');
    } else {
      console.log('🔒 [get-or-create-stream-key] Channel is NOT public and user is NOT owner - checking collaborator status...');
      // For non-public channels, check if user is a collaborator
      try {
        const userCollaborationResult = await dynamodb.get({
          TableName: table,
          Key: {
            PK: `USER#${userId}`,
            SK: `COLLABORATOR_ROLE#${channelId}`
          }
        }).promise();

        if (!userCollaborationResult.Item) {
          // User is not a collaborator and channel is not public - deny access
          console.log('❌ [get-or-create-stream-key] Access denied - user is not a collaborator and channel is not public:', {
            userId,
            channelId,
            isPublicChannel,
            isChannelOwner
          });
          return {
            success: false,
            message: 'You do not have access to this channel'
          };
        } else {
          console.log('✅ [get-or-create-stream-key] User is a collaborator:', {
            userId,
            channelId,
            collaborationItem: userCollaborationResult.Item
          });
        }
      } catch (error) {
        console.error('❌ [get-or-create-stream-key] Error checking user collaboration:', error);
        console.error('   Error details:', error.message, error.stack);
        // If we can't check, deny access for safety
        return {
          success: false,
          message: 'Unable to verify channel access'
        };
      }
    }

    // User has access (either public channel or existing collaborator) - create/get stream key
    try {
      // Check if user already has a collaborator role record
      const userCollaborationResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `USER#${userId}`,
          SK: `COLLABORATOR_ROLE#${channelId}`
        }
      }).promise();

      if (!userCollaborationResult.Item) {
        // User doesn't have collaboration record yet - create it (for public channels or new collaborators)
        console.log('🔨 [get-or-create-stream-key] Creating NEW collaboration record:', {
          userId,
          channelId,
          channelName,
          userEmail,
          isPublicChannel
        });
        
        // Generate stream key
        const streamKey = `sk_${generateRandomString(16)}`;
        console.log('🔑 [get-or-create-stream-key] Generated new stream key:', streamKey);
        
        // Create collaboration records
        const collaborationRecord = {
          PK: `CHANNEL#${channelId}`,
          SK: `COLLABORATOR#${userId}`,
          channelId: channelId,
          channelName: channelName,
          userId: userId,
          userEmail: userEmail,
          streamKey: streamKey,
          joinedAt: new Date().toISOString(),
          status: 'active',
          role: 'collaborator',
          hasPayoutSetup: false, // Will be set when user sets up payout
          payoutSetupRequired: true
        };

        const userCollaborationRecord = {
          PK: `USER#${userId}`,
          SK: `COLLABORATOR_ROLE#${channelId}`,
          channelId: channelId,
          channelName: channelName,
          streamKey: streamKey,
          joinedAt: new Date().toISOString(),
          status: 'active',
          role: 'collaborator',
          hasPayoutSetup: false,
          payoutSetupRequired: true
        };

        // Create stream key mapping
        // CRITICAL: For collaborator keys, use collaboratorEmail (not ownerEmail)
        // This ensures videos are correctly attributed to the collaborator with their username
        const streamKeyMapping = {
          PK: `STREAM_KEY#${streamKey}`,
          SK: 'MAPPING',
          streamKey: streamKey,
          collaboratorEmail: userEmail, // Use collaboratorEmail for collaborator keys
          channelName: channelName, // Use channelName (not seriesName) for consistency
          creatorId: userId, // This is the collaborator's userId for username lookup
          channelId: channelId,
          isActive: true,
          isPersonalKey: false,
          isCollaboratorKey: true,
          createdAt: new Date().toISOString(),
          keyNumber: 1,
          status: 'ACTIVE'
        };

        // Store all records
        await dynamodb.put({
          TableName: table,
          Item: collaborationRecord
        }).promise();

        await dynamodb.put({
          TableName: table,
          Item: userCollaborationRecord
        }).promise();

        await dynamodb.put({
          TableName: table,
          Item: streamKeyMapping
        }).promise();

        // CRITICAL: Create placeholder private STREAM_KEY mapping so private account appears immediately
        // This ensures users can be found in private search even before they stream
        try {
          // Get username from profile
          const profileResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `USER#${userEmail}`,
              SK: 'PROFILE'
            }
          }).promise();
          
          const username = profileResult.Item?.username || userEmail.split('@')[0];
          const privateStreamKey = `sk_private_${userId || userEmail.replace('@', '_').replace(/[^a-z0-9_]/gi, '')}`;
          const privateStreamUsername = `${username}🔒`;
          
          // Check if private mapping already exists
          const existingPrivateMapping = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `STREAM_KEY#${privateStreamKey}`,
              SK: 'MAPPING'
            }
          }).promise();
          
          if (!existingPrivateMapping.Item) {
            const privateStreamKeyMapping = {
              PK: `STREAM_KEY#${privateStreamKey}`,
              SK: 'MAPPING',
              streamKey: privateStreamKey,
              streamUsername: privateStreamUsername, // Username with 🔒
              isPrivateUsername: true,
              collaboratorEmail: userEmail,
              creatorId: userId,
              channelName: channelName,
              channelId: channelId,
              isActive: true,
              isPersonalKey: false,
              isCollaboratorKey: true,
              isPlaceholder: true, // Flag to indicate this is a placeholder (not a real stream key)
              createdAt: new Date().toISOString(),
              status: 'ACTIVE'
            };
            
            await dynamodb.put({
              TableName: table,
              Item: privateStreamKeyMapping
            }).promise();
            
            console.log(`✅ [get-or-create-stream-key] Created placeholder private mapping: ${privateStreamUsername} (key: ${privateStreamKey})`);
          } else {
            console.log(`ℹ️ [get-or-create-stream-key] Private mapping already exists for ${privateStreamUsername}`);
          }
        } catch (privateError) {
          console.error(`⚠️ [get-or-create-stream-key] Error creating private placeholder mapping: ${privateError.message}`);
          // Don't fail the whole request if private mapping creation fails
        }

        console.log('✅ [get-or-create-stream-key] Successfully created new collaborator key:', {
          userId,
          channelId,
          streamKey,
          recordsCreated: 3
        });

        return {
          success: true,
          streamKey: streamKey,
          isNew: true,
          message: 'Collaborator stream key created successfully'
        };
      } else {
        // User is a collaborator but doesn't have a stream key yet - create one
        const existingCollaboration = userCollaborationResult.Item;
        
        if (existingCollaboration.streamKey) {
          // Stream key already exists in user record
          console.log('✅ [get-or-create-stream-key] Found existing stream key in user collaboration record:', {
            userId,
            channelId,
            streamKey: existingCollaboration.streamKey
          });
          return {
            success: true,
            streamKey: existingCollaboration.streamKey,
            isNew: false,
            message: 'Stream key retrieved successfully'
          };
        }

        // Generate new stream key
        console.log('🔨 [get-or-create-stream-key] User has collaboration but no stream key - generating new one:', {
          userId,
          channelId
        });
        const streamKey = `sk_${generateRandomString(16)}`;
        console.log('🔑 [get-or-create-stream-key] Generated stream key:', streamKey);
        
        // Update collaboration records with stream key
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `CHANNEL#${channelId}`,
            SK: `COLLABORATOR#${userId}`
          },
          UpdateExpression: 'SET streamKey = :streamKey',
          ExpressionAttributeValues: {
            ':streamKey': streamKey
          }
        }).promise();

        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `USER#${userId}`,
            SK: `COLLABORATOR_ROLE#${channelId}`
          },
          UpdateExpression: 'SET streamKey = :streamKey',
          ExpressionAttributeValues: {
            ':streamKey': streamKey
          }
        }).promise();

        // Create stream key mapping
        // CRITICAL: For collaborator keys, use collaboratorEmail (not ownerEmail)
        // This ensures videos are correctly attributed to the collaborator with their username
        const streamKeyMapping = {
          PK: `STREAM_KEY#${streamKey}`,
          SK: 'MAPPING',
          streamKey: streamKey,
          collaboratorEmail: userEmail, // Use collaboratorEmail for collaborator keys
          channelName: channelName, // Use channelName (not seriesName) for consistency
          creatorId: userId, // This is the collaborator's userId for username lookup
          channelId: channelId,
          isActive: true,
          isPersonalKey: false,
          isCollaboratorKey: true,
          createdAt: new Date().toISOString(),
          keyNumber: 1,
          status: 'ACTIVE'
        };

        await dynamodb.put({
          TableName: table,
          Item: streamKeyMapping
        }).promise();

        // CRITICAL: Create placeholder private STREAM_KEY mapping so private account appears immediately
        try {
          const profileResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `USER#${userEmail}`,
              SK: 'PROFILE'
            }
          }).promise();
          
          const username = profileResult.Item?.username || userEmail.split('@')[0];
          const privateStreamKey = `sk_private_${userId || userEmail.replace('@', '_').replace(/[^a-z0-9_]/gi, '')}`;
          const privateStreamUsername = `${username}🔒`;
          
          const existingPrivateMapping = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `STREAM_KEY#${privateStreamKey}`,
              SK: 'MAPPING'
            }
          }).promise();
          
          if (!existingPrivateMapping.Item) {
            const privateStreamKeyMapping = {
              PK: `STREAM_KEY#${privateStreamKey}`,
              SK: 'MAPPING',
              streamKey: privateStreamKey,
              streamUsername: privateStreamUsername,
              isPrivateUsername: true,
              collaboratorEmail: userEmail,
              creatorId: userId,
              channelName: channelName,
              channelId: channelId,
              isActive: true,
              isPersonalKey: false,
              isCollaboratorKey: true,
              isPlaceholder: true,
              createdAt: new Date().toISOString(),
              status: 'ACTIVE'
            };
            
            await dynamodb.put({
              TableName: table,
              Item: privateStreamKeyMapping
            }).promise();
            
            console.log(`✅ [get-or-create-stream-key] Created placeholder private mapping: ${privateStreamUsername} (key: ${privateStreamKey})`);
          }
        } catch (privateError) {
          console.error(`⚠️ [get-or-create-stream-key] Error creating private placeholder mapping: ${privateError.message}`);
        }

        console.log('✅ [get-or-create-stream-key] Successfully created stream key for existing collaborator:', {
          userId,
          channelId,
          streamKey
        });

        return {
          success: true,
          streamKey: streamKey,
          isNew: true,
          message: 'Stream key created successfully'
        };
      }
    } catch (error) {
      console.error('❌ [get-or-create-stream-key] Error in collaboration creation/retrieval:', error);
      console.error('   Error details:', error.message, error.stack);
      return {
        success: false,
        message: `Failed to get or create collaborator stream key: ${error.message || 'Unknown error'}`
      };
    }

  } catch (error) {
    console.error('❌ [get-or-create-stream-key] Top-level error:', error);
    console.error('   Error details:', error.message, error.stack);
    return {
      success: false,
      message: `Failed to get or create collaborator stream key: ${error.message || 'Unknown error'}`
    };
  }
});
