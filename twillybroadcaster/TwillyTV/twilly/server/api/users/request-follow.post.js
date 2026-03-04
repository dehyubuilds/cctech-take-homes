import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    let { requesterEmail, requestedUsername, requesterUsername, isPrivateStreamRequest } = body;

    if (!requesterEmail || !requestedUsername) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: requesterEmail and requestedUsername'
      });
    }

    console.log(`📩 [request-follow] ${requesterEmail} (username: ${requesterUsername || 'not provided'}) requesting to follow ${requestedUsername}`);
    console.log(`   📋 Request body: requesterEmail=${requesterEmail}, requestedUsername=${requestedUsername}, requesterUsername=${requesterUsername || 'NOT PROVIDED'}, isPrivateStreamRequest=${isPrivateStreamRequest}`);
    // Deployment trigger - ensure endpoint is available
    
    // CRITICAL: Normalize requesterEmail early to ensure all lookups use lowercase
    if (requesterEmail) {
      requesterEmail = requesterEmail.toLowerCase();
    }
    
    // CRITICAL: If requesterUsername is not provided, fetch it from PROFILE
    // This ensures we always have the requester's username for notifications and logging
    if (!requesterUsername || requesterUsername.trim() === '') {
      console.log(`⚠️ [request-follow] requesterUsername not provided in request - fetching from PROFILE...`);
      try {
        const requesterProfileParams = {
          TableName: table,
          Key: {
            PK: `USER#${requesterEmail.toLowerCase()}`, // CRITICAL: Normalize email to lowercase
            SK: 'PROFILE'
          }
        };
        const requesterProfileResult = await dynamodb.get(requesterProfileParams).promise();
        if (requesterProfileResult.Item && requesterProfileResult.Item.username) {
          requesterUsername = requesterProfileResult.Item.username;
          console.log(`✅ [request-follow] Fetched requester username from PROFILE: "${requesterUsername}"`);
        } else {
          console.log(`⚠️ [request-follow] Could not find requester username in PROFILE - will use email prefix as fallback`);
        }
      } catch (error) {
        console.log(`⚠️ [request-follow] Error fetching requester profile: ${error.message}`);
      }
    } else {
      console.log(`✅ [request-follow] Using requester username from request: "${requesterUsername}"`);
    }

    // OPTIMIZED: Use GSI for fast username lookup (NO SCANS - performance critical)
    // GSI: UsernameSearchIndex
    //   Partition Key: usernameVisibility (public/private)
    //   Sort Key: username
    const requestedUsernameLower = requestedUsername.toLowerCase();
    let requestedUser = null;
    
    try {
      // Try exact match first (fastest - single GSI query per visibility)
      for (const visibility of ['public', 'private']) {
        const queryParams = {
          TableName: table,
          IndexName: 'UsernameSearchIndex',
          KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
          ExpressionAttributeValues: {
            ':visibility': visibility,
            ':username': requestedUsername // Exact match (case-sensitive in DynamoDB)
          },
          Limit: 1
        };
        
        const result = await dynamodb.query(queryParams).promise();
        if (result.Items && result.Items.length > 0) {
          const foundUser = result.Items[0];
          // Verify case-insensitive match
          if (foundUser.username && foundUser.username.toLowerCase() === requestedUsernameLower) {
            requestedUser = foundUser;
            console.log(`✅ [request-follow] Found user via GSI exact match: ${requestedUsername}`);
            break;
          }
        }
      }
      
      // If exact match failed, try common case variations (still fast - only 2-3 queries max)
      if (!requestedUser) {
        const caseVariations = [
          requestedUsernameLower, // lowercase
          requestedUsernameLower.charAt(0).toUpperCase() + requestedUsernameLower.slice(1), // Capitalized
          requestedUsername.toUpperCase() // UPPERCASE
        ];
        
        // Remove duplicates
        const uniqueVariations = [...new Set(caseVariations)];
        
        for (const variation of uniqueVariations) {
          if (variation === requestedUsername) continue; // Already tried exact match
          
          for (const visibility of ['public', 'private']) {
            const queryParams = {
              TableName: table,
              IndexName: 'UsernameSearchIndex',
              KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
              ExpressionAttributeValues: {
                ':visibility': visibility,
                ':username': variation
              },
              Limit: 1
            };
            
            const result = await dynamodb.query(queryParams).promise();
            if (result.Items && result.Items.length > 0) {
              const foundUser = result.Items[0];
              if (foundUser.username && foundUser.username.toLowerCase() === requestedUsernameLower) {
                requestedUser = foundUser;
                console.log(`✅ [request-follow] Found user via GSI case variation: ${variation}`);
                break;
              }
            }
          }
          if (requestedUser) break;
        }
      }
    } catch (error) {
      // If GSI doesn't exist, fail fast with clear error (NO SCAN fallback)
      if (error.code === 'ResourceNotFoundException' || 
          error.message.includes('index') || 
          error.message.includes('UsernameSearchIndex')) {
        console.error('❌ [request-follow] GSI not available - cannot perform username lookup');
        throw createError({
          statusCode: 500,
          statusMessage: 'Username search index not available. Please contact support.'
        });
      } else {
        throw error;
      }
    }

    if (!requestedUser) {
      console.log(`❌ [request-follow] User not found: ${requestedUsername}`);
      throw createError({
        statusCode: 404,
        statusMessage: `User "${requestedUsername}" not found. Please check the username and try again.`
      });
    }

    // Extract email and userId based on PK format
    // CRITICAL: PK might be a user ID (UUID) or an email - we need to get the actual email
    let requestedUserEmail = requestedUser.email || requestedUser.userEmail;
    const pkValue = requestedUser.PK ? requestedUser.PK.replace('USER#', '') : null;
    
    // If PK is an email (contains @), use it
    // If PK is a user ID (UUID), we need to get email from PROFILE
    if (pkValue && pkValue.includes('@')) {
      // PK is an email - use it as fallback if email/userEmail fields are missing
      requestedUserEmail = requestedUserEmail || pkValue;
    } else if (pkValue && !requestedUserEmail) {
      // PK is a user ID and we don't have email - get it from PROFILE
      console.log(`🔍 [request-follow] PK is user ID (${pkValue}), fetching email from PROFILE...`);
      try {
        const profileParams = {
          TableName: table,
          Key: {
            PK: requestedUser.PK,
            SK: 'PROFILE'
          }
        };
        const profileResult = await dynamodb.get(profileParams).promise();
        if (profileResult.Item && profileResult.Item.email) {
          requestedUserEmail = profileResult.Item.email;
          console.log(`✅ [request-follow] Got email from PROFILE: ${requestedUserEmail}`);
        }
      } catch (error) {
        console.error(`❌ [request-follow] Could not get PROFILE for ${requestedUser.PK}: ${error.message}`);
      }
    }
    
    // CRITICAL: Normalize emails to lowercase to prevent case-sensitivity issues
    if (requestedUserEmail) {
      requestedUserEmail = requestedUserEmail.toLowerCase();
    }
    if (requesterEmail) {
      requesterEmail = requesterEmail.toLowerCase();
    }
    
    // CRITICAL: Log the email extraction for debugging
    console.log(`📧 [request-follow] Extracted email: ${requestedUserEmail} (from PK: ${requestedUser.PK}, email field: ${requestedUser.email || 'N/A'}, userEmail field: ${requestedUser.userEmail || 'N/A'})`);
    
    if (!requestedUserEmail) {
      console.error(`❌ [request-follow] CRITICAL: Could not extract email for username: ${requestedUsername}`);
      throw createError({
        statusCode: 500,
        statusMessage: `Could not determine email for user "${requestedUsername}"`
      });
    }
    
    // CRITICAL: Get PROFILE username (single source of truth)
    // All users are public by default - no need to check visibility
    let profileUsername = null;
    if (requestedUserEmail) {
      try {
        const profileParams = {
          TableName: table,
          Key: {
            PK: `USER#${requestedUserEmail.toLowerCase()}`, // CRITICAL: Normalize email to lowercase
            SK: 'PROFILE'
          }
        };
        const profileResult = await dynamodb.get(profileParams).promise();
        if (profileResult.Item && profileResult.Item.username) {
          profileUsername = profileResult.Item.username;
          console.log(`✅ [request-follow] Found PROFILE username: "${profileUsername}" (single source of truth)`);
        } else {
          console.log(`⚠️ [request-follow] PROFILE not found or username not set for ${requestedUserEmail}`);
        }
      } catch (error) {
        console.log(`⚠️ [request-follow] Could not fetch PROFILE for ${requestedUserEmail}: ${error.message}`);
      }
    }
    
    if (!profileUsername) {
      throw createError({
        statusCode: 404,
        statusMessage: `User profile not found or username not set for ${requestedUserEmail}`
      });
    }
    
    // Verify that the requested username matches PROFILE username (case-insensitive)
    const cleanRequestedUsername = requestedUsername.replace(/🔒/g, '').trim();
    const requestedMatchesProfile = cleanRequestedUsername.toLowerCase() === profileUsername.toLowerCase();
    
    if (!requestedMatchesProfile) {
      console.log(`⚠️ [request-follow] WARNING: Requested username "${cleanRequestedUsername}" does not match PROFILE username "${profileUsername}"`);
      console.log(`   Using PROFILE username "${profileUsername}" as single source of truth`);
    }
    
    // ALWAYS use PROFILE username (single source of truth)
    const usernameToUse = profileUsername;
    
    console.log(`✅ [request-follow] Found user: ${usernameToUse} (email: ${requestedUserEmail})`);

    // CRITICAL: Check if this is a private stream request
    // Can be indicated by: 1) isPrivateStreamRequest parameter from frontend, or 2) 🔒 in username (legacy)
    // Private stream requests should ALWAYS create a FOLLOW_REQUEST, never auto-accept
    // All other requests are public and should auto-accept
    const isPrivateStreamRequestFromParam = isPrivateStreamRequest === true || isPrivateStreamRequest === 'true';
    const isPrivateStreamRequestFromUsername = requestedUsername.includes('🔒');
    const isPrivateStreamRequestFinal = isPrivateStreamRequestFromParam || isPrivateStreamRequestFromUsername;

    console.log(`🔍 [request-follow] Username analysis: requested='${cleanRequestedUsername}', PROFILE='${usernameToUse}', isPrivateStreamRequest=${isPrivateStreamRequestFinal}`);

    // PRIVATE REQUEST FLOW REMOVED: Private account owners now add viewers directly
    // Only public requests are allowed through this endpoint
    if (isPrivateStreamRequestFinal) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Private follow requests are no longer supported. Private account owners must add viewers directly from their account settings.'
      });
    } else {
      // All non-private requests are public and should auto-accept
      // No need to check visibility - all users are public by default
      console.log(`✅ [request-follow] Public account request (no 🔒) - auto-accepting`);
      console.log(`   📝 Details: requesterEmail=${requesterEmail}, requestedUserEmail=${requestedUserEmail}, usernameToUse=${usernameToUse}`);
      
      // CRITICAL: Prevent adding yourself (self-add prevention)
      if (requesterEmail.toLowerCase() === requestedUserEmail.toLowerCase()) {
        console.log(`🚫 [request-follow] Blocking self-add: requester and requested are the same user`);
        throw createError({
          statusCode: 400,
          statusMessage: 'Cannot add yourself to your timeline'
        });
      }
      
      // Check if already added as public
      // CRITICAL: Use visibility in SK to allow separate public/private entries
      // SK format: ADDED_USERNAME#ownerEmail#public or ADDED_USERNAME#ownerEmail#private
      const existingAddedParams = {
        TableName: table,
        Key: {
          PK: `USER#${requesterEmail.toLowerCase()}`,
          SK: `ADDED_USERNAME#${requestedUserEmail.toLowerCase()}#public`
        }
      };
      const existingAdded = await dynamodb.get(existingAddedParams).promise();
      
      if (existingAdded.Item) {
        console.log(`⚠️ [request-follow] User already added as public - returning existing entry`);
        return {
          success: false,
          message: 'User already added to timeline',
          status: 'active',
          autoAccepted: true
        };
      }
      
      // Add username to requester's timeline
      // CRITICAL: Normalize emails to lowercase for consistent lookups
      // SK includes visibility to allow separate public/private entries
      const addParams = {
        TableName: table,
        Item: {
          PK: `USER#${requesterEmail.toLowerCase()}`,
          SK: `ADDED_USERNAME#${requestedUserEmail.toLowerCase()}#public`,
          status: 'active',
          addedAt: new Date().toISOString(),
          streamerUsername: usernameToUse, // ALWAYS use PROFILE username (single source of truth)
          streamerEmail: requestedUserEmail.toLowerCase(), // Normalize email
          streamerVisibility: 'public',
          autoAccepted: true
        }
      };

      console.log(`💾 [request-follow] Creating ADDED_USERNAME entry:`, JSON.stringify(addParams.Item, null, 2));
      
      try {
        await dynamodb.put(addParams).promise();
        console.log(`✅ [request-follow] Successfully created ADDED_USERNAME entry`);
        // Reverse index for fan-out (query by creator, no scan)
        await dynamodb.put({
          TableName: table,
          Item: {
            PK: `STREAMER_FOLLOWERS#${requestedUserEmail.toLowerCase()}`,
            SK: `VIEWER#${requesterEmail.toLowerCase()}`,
            streamerVisibility: 'public',
            status: 'active',
            addedAt: new Date().toISOString()
          }
        }).promise();
        // CRITICAL: Populate timeline with existing content from added user (async, don't block)
        // This creates timeline entries so future queries are fast (single query vs N queries)
        // Use dynamic import for ES modules
        (async () => {
          try {
            const { populateTimelineOnAdd } = await import('../channels/timeline-utils.js');
            await populateTimelineOnAdd(
              requesterEmail.toLowerCase(),
              requestedUserEmail.toLowerCase(),
              usernameToUse,
              'public'
            );
            console.log(`✅ [request-follow] Timeline populated for ${requesterEmail}`);
          } catch (err) {
            console.error(`⚠️ [request-follow] Timeline population failed (non-blocking): ${err.message}`);
          }
        })();
        
        // ============================================
        // Create notification for added user (public access granted)
        // Only notify on first add (not re-adds) - this code only runs if existingAdded.Item was null
        // ============================================
        try {
          const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const notificationParams = {
            TableName: table,
            Item: {
              PK: `USER#${requestedUserEmail.toLowerCase()}`,
              SK: `NOTIFICATION#${notificationId}`,
              type: 'public_access_granted',
              title: 'Added to Public Timeline',
              message: `You were added to ${requesterUsername || requesterEmail.split('@')[0]}'s public timeline`,
              metadata: {
                requesterEmail: String(requesterEmail.toLowerCase()),
                requesterUsername: String(requesterUsername || requesterEmail.split('@')[0]),
                requestedEmail: String(requestedUserEmail.toLowerCase()),
                requestedUsername: String(usernameToUse)
              },
              isRead: false,
              createdAt: new Date().toISOString()
            }
          };

          await dynamodb.put(notificationParams).promise();
          console.log(`✅ [request-follow] Notification created successfully:`);
          console.log(`   PK: ${notificationParams.Item.PK}`);
          console.log(`   SK: ${notificationParams.Item.SK}`);
          console.log(`   Type: ${notificationParams.Item.type}`);
          console.log(`   Message: ${notificationParams.Item.message}`);
          console.log(`   Requester: ${requesterUsername || requesterEmail.split('@')[0]} (${requesterEmail})`);
          console.log(`   Requested: ${usernameToUse} (${requestedUserEmail})`);
          console.log(`   📬 Notification will be queryable with: PK=USER#${requestedUserEmail.toLowerCase()}`);
          
          // PHASE 1-3: Send WebSocket notification via optimized cache service
          try {
            const { sendWebSocketNotification } = await import('../../utils/websocket-cache.js');
            const websocketApiEndpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                                        process.env.WSS_ENDPOINT ||
                                        'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';
            
            await sendWebSocketNotification(
              [requestedUserEmail.toLowerCase()],
              'notification',
              {
                notificationType: 'public_access_granted',
                notificationId: notificationId,
                title: notificationParams.Item.title,
                message: notificationParams.Item.message,
                metadata: notificationParams.Item.metadata
              },
              websocketApiEndpoint,
              true // Lambda fallback for backward compatibility
            );
            console.log(`📡 [request-follow] WebSocket notification sent to ${requestedUserEmail}`);
          } catch (wsError) {
            console.error(`⚠️ [request-follow] Failed to send WebSocket notification: ${wsError.message}`);
            // Continue - WebSocket is non-blocking
          }
        } catch (err) {
          console.error(`❌ [request-follow] Notification creation FAILED: ${err.message}`);
          console.error(`   Stack: ${err.stack}`);
          // Don't throw - notification is non-blocking
        }
      } catch (putError) {
        console.error(`❌ [request-follow] Failed to create ADDED_USERNAME entry:`, putError);
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to add user to timeline: ${putError.message}`
        });
      }

      return {
        success: true,
        message: 'User added to timeline (public account)',
        autoAccepted: true,
        status: 'active'
      };
    }

    // Check if request already exists
    const existingRequestParams = {
      TableName: table,
      Key: {
        PK: `USER#${requestedUserEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`
      }
    };

    const existingRequest = await dynamodb.get(existingRequestParams).promise();

    // CRITICAL: One-way flow - once "Requested", can't go back to "Request"
    // Standard lifecycle (like Instagram/Snapchat):
    // Request → Requested (pending) → Approved (accepted) OR stays Requested (if declined)
    // If approved and then removed → Rejected (can't request again)
    // If declined → stays Requested from requester's perspective (can't request again)
    if (existingRequest.Item) {
      const status = existingRequest.Item.status;
      if (status === 'pending') {
        // Already requested - one-way flow, can't request again
        return {
          success: false,
          message: 'Follow request already sent',
          status: 'pending' // This is "requested" from requester's perspective
        };
      } else if (status === 'accepted') {
        // Already approved - user is in added list, can't request again
        return {
          success: false,
          message: 'Follow request already accepted',
          status: 'accepted'
        };
      } else if (status === 'rejected') {
        // Was approved but removed - can't request again (one-way flow)
        return {
          success: false,
          message: 'Follow request was removed',
          status: 'rejected'
        };
      } else if (status === 'declined') {
        // Was declined - requester still sees "Requested", can't request again (one-way flow)
        // This matches Instagram/Snapchat behavior: once requested, stays requested even if declined
        return {
          success: false,
          message: 'Follow request was declined',
          status: 'declined' // Frontend will show this as "Requested" (disabled)
        };
      }
    }

    // Get requester's username (use provided from frontend, or fetch from PROFILE)
    // Frontend should always pass requesterUsername from authService.username
    // If not provided, fetch from PROFILE to ensure we always have it
    let requesterUsernameForRequest = requesterUsername || '';
    
    if (!requesterUsernameForRequest || requesterUsernameForRequest.trim() === '') {
      console.log(`⚠️ [request-follow] Requester username not provided in request - fetching from PROFILE...`);
      try {
        const requesterProfileParams = {
          TableName: table,
          Key: {
            PK: `USER#${requesterEmail}`,
            SK: 'PROFILE'
          }
        };
        const requesterProfileResult = await dynamodb.get(requesterProfileParams).promise();
        if (requesterProfileResult.Item && requesterProfileResult.Item.username) {
          requesterUsernameForRequest = requesterProfileResult.Item.username;
          console.log(`✅ [request-follow] Fetched requester username from PROFILE: "${requesterUsernameForRequest}"`);
        } else {
          console.log(`⚠️ [request-follow] Could not find requester username in PROFILE - will use email prefix as fallback`);
          requesterUsernameForRequest = requesterEmail.split('@')[0]; // Fallback to email prefix
        }
      } catch (error) {
        console.log(`⚠️ [request-follow] Error fetching requester profile: ${error.message}`);
        requesterUsernameForRequest = requesterEmail.split('@')[0]; // Fallback to email prefix
      }
    } else {
      console.log(`✅ [request-follow] Using requester username from request: "${requesterUsernameForRequest}"`);
    }

    // Create follow request (for private accounts or private stream requests)
    // Store both usernames so they can be displayed without lookup
    const requestParams = {
      TableName: table,
      Item: {
        PK: `USER#${requestedUserEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        requesterEmail: requesterEmail,
        requesterUsername: requesterUsernameForRequest || '', // Store requester's username (person making request)
        requestedUsername: usernameToUse, // ALWAYS use PROFILE username (single source of truth)
        isPrivateStreamRequest: isPrivateStreamRequest // Flag to distinguish private stream requests
      }
    };

    await dynamodb.put(requestParams).promise();

    // CRITICAL: Create notification for requested user that they have a new follow request
    try {
      // Use the username we already stored in the request (no lookup needed - avoids slow SCAN)
      // This is the same username we used when creating the request item above
      let requesterUsernameForNotification = requesterUsernameForRequest || requesterUsername || '';
      
      if (requesterUsernameForNotification) {
        console.log(`✅ [request-follow] Using requester username for notification: ${requesterUsernameForNotification}`);
      } else {
        // Final fallback: use email prefix if username not available
        requesterUsernameForNotification = requesterEmail.split('@')[0];
        console.log(`⚠️ [request-follow] Username not available, using email prefix: ${requesterUsernameForNotification}`);
      }

      const notificationParams = {
        TableName: table,
        Item: {
          PK: `USER#${requestedUserEmail}`,
          SK: `NOTIFICATION#${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'follow_request',
          title: 'New Follow Request',
          message: `${requesterUsernameForNotification} wants to follow you`,
          metadata: {
            requesterEmail: requesterEmail,
            requesterUsername: requesterUsernameForNotification,
            requestedUsername: requestedUsername
          },
          isRead: false,
          createdAt: new Date().toISOString()
        }
      };

      await dynamodb.put(notificationParams).promise();
      console.log(`✅ [request-follow] Notification created for requested user: ${requestedUserEmail}`);
      console.log(`   📧 Notification PK: USER#${requestedUserEmail}`);
      console.log(`   📝 Notification message: ${requesterUsernameForNotification} wants to follow you`);
      console.log(`   🔍 Using PROFILE username: ${usernameToUse} (single source of truth)`);
    } catch (notificationError) {
      // Don't fail the request if notification creation fails
      console.error(`⚠️ [request-follow] Failed to create notification: ${notificationError.message}`);
    }

    console.log(`✅ [request-follow] Follow request created`);

    return {
      success: true,
      message: 'Follow request sent',
      status: 'pending'
    };

  } catch (error) {
    console.error('❌ [request-follow] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to send follow request'
    });
  }
});
