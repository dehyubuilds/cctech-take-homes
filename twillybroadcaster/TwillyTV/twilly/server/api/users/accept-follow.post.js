import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    let { userEmail, requesterEmail } = body;

    if (!userEmail || !requesterEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: userEmail and requesterEmail'
      });
    }

    // CRITICAL: Normalize emails to lowercase to prevent case-sensitivity issues
    userEmail = userEmail.toLowerCase();
    requesterEmail = requesterEmail.toLowerCase();

    console.log(`✅ [accept-follow] ${userEmail} accepting follow request from ${requesterEmail}`);

    // Get the follow request
    const requestParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`
      }
    };

    const requestResult = await dynamodb.get(requestParams).promise();

    if (!requestResult.Item) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Follow request not found'
      });
    }

    if (requestResult.Item.status !== 'pending') {
      throw createError({
        statusCode: 400,
        statusMessage: `Follow request is already ${requestResult.Item.status}`
      });
    }

    // CRITICAL: ALWAYS use PROFILE username (the one shown in settings) - single source of truth
    // The PROFILE username is what the user sees in settings and is the authoritative username
    // We should NEVER use requestedUsername or any other source - only PROFILE.username
    const userProfileParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      }
    };

    const userProfile = await dynamodb.get(userProfileParams).promise();
    
    if (!userProfile.Item || !userProfile.Item.username) {
      throw createError({
        statusCode: 404,
        statusMessage: `User profile not found or username not set for ${userEmail}`
      });
    }
    
    // ALWAYS use PROFILE username - this is the single source of truth
    const streamerUsernameToUse = userProfile.Item.username;
    
    console.log(`✅ [accept-follow] Using PROFILE username (single source of truth): "${streamerUsernameToUse}"`);

    // Update follow request status to accepted
    const updateRequestParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`
      },
      UpdateExpression: 'SET #status = :status, respondedAt = :respondedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'accepted',
        ':respondedAt': new Date().toISOString()
      }
    };

    await dynamodb.update(updateRequestParams).promise();

    // Add username to requester's timeline
    // CRITICAL: ALWAYS use PROFILE username (single source of truth)
    // This ensures consistency - the username in ADDED_USERNAME matches what's in PROFILE
    const addParams = {
      TableName: table,
      Item: {
        PK: `USER#${requesterEmail}`,
        SK: `ADDED_USERNAME#${userEmail}`,
        status: 'active',
        addedAt: new Date().toISOString(),
        streamerUsername: streamerUsernameToUse, // ALWAYS use PROFILE username
        streamerEmail: userEmail,
        streamerVisibility: userProfile.Item.usernameVisibility || 'private',
        acceptedAt: new Date().toISOString()
      }
    };

    await dynamodb.put(addParams).promise();
    const visibility = (userProfile.Item.usernameVisibility || 'private').toLowerCase();
    // Reverse index for fan-out (query by creator, no scan)
    await dynamodb.put({
      TableName: table,
      Item: {
        PK: `STREAMER_FOLLOWERS#${userEmail.toLowerCase()}`,
        SK: `VIEWER#${requesterEmail.toLowerCase()}`,
        streamerVisibility: visibility,
        status: 'active',
        addedAt: new Date().toISOString()
      }
    }).promise();

    // CRITICAL: Populate timeline with existing content from added user (async, don't block)
    // This creates timeline entries so future queries are fast (single query vs N queries)
    (async () => {
      try {
        const { populateTimelineOnAdd } = await import('../channels/timeline-utils.js');
        await populateTimelineOnAdd(
          requesterEmail.toLowerCase(),
          userEmail.toLowerCase(),
          streamerUsernameToUse,
          userProfile.Item.usernameVisibility || 'private'
        );
        console.log(`✅ [accept-follow] Timeline populated for ${requesterEmail}`);
      } catch (err) {
        console.error(`⚠️ [accept-follow] Timeline population failed (non-blocking): ${err.message}`);
      }
    })();

    // CRITICAL: Create notification for requester that their request was accepted
    try {
      // Use PROFILE username for notification (single source of truth)
      const notificationUsername = streamerUsernameToUse;
      const notificationParams = {
        TableName: table,
        Item: {
          PK: `USER#${requesterEmail}`,
          SK: `NOTIFICATION#${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'follow_accepted',
          title: 'Follow Request Accepted',
          message: `${notificationUsername} accepted your follow request`,
          metadata: {
            acceptedByEmail: userEmail,
            acceptedByUsername: notificationUsername
          },
          isRead: false,
          createdAt: new Date().toISOString()
        }
      };

      await dynamodb.put(notificationParams).promise();
      console.log(`✅ [accept-follow] Notification created for requester: ${requesterEmail}`);
      
      // PHASE 1-3: Send WebSocket notification via optimized cache service
      try {
        const { sendWebSocketNotification } = await import('../../utils/websocket-cache.js');
        const websocketApiEndpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                                    process.env.WSS_ENDPOINT ||
                                    'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';
        
        await sendWebSocketNotification(
          [requesterEmail],
          'follow_response',
          {
            requesterEmail: requesterEmail,
            status: 'accepted'
          },
          websocketApiEndpoint,
          true // Lambda fallback for backward compatibility
        );
        console.log(`📡 [accept-follow] WebSocket notification sent to ${requesterEmail}`);
      } catch (wsError) {
        console.error(`⚠️ [accept-follow] Failed to send WebSocket notification: ${wsError.message}`);
        // Continue - WebSocket is non-blocking
      }
    } catch (notificationError) {
      // Don't fail the accept if notification creation fails
      console.error(`⚠️ [accept-follow] Failed to create notification: ${notificationError.message}`);
    }

    console.log(`✅ [accept-follow] Follow request accepted and user added to timeline`);

    return {
      success: true,
      message: 'Follow request accepted',
      status: 'accepted'
    };

  } catch (error) {
    console.error('❌ [accept-follow] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to accept follow request'
    });
  }
});
