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
    // Deployment trigger - ensure endpoint is available

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
    let requestedUserEmail = requestedUser.email || requestedUser.userEmail;
    if (requestedUser.PK && requestedUser.PK.startsWith('USER#')) {
      requestedUserEmail = requestedUserEmail || requestedUser.PK.replace('USER#', '');
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
    
    // Get visibility from user profile
    // Try to get from the user item first, then lookup PROFILE if needed
    let visibility = requestedUser.usernameVisibility || 'public';
    
    // If not found in user item, try to get from PROFILE
    if (!requestedUser.usernameVisibility && requestedUserEmail) {
      try {
        const profileParams = {
          TableName: table,
          Key: {
            PK: `USER#${requestedUserEmail}`,
            SK: 'PROFILE'
          }
        };
        const profileResult = await dynamodb.get(profileParams).promise();
        if (profileResult.Item) {
          visibility = profileResult.Item.usernameVisibility || 'public';
        }
      } catch (error) {
        console.log(`⚠️ [request-follow] Could not fetch profile for ${requestedUserEmail}, defaulting to public`);
      }
    }

    // CRITICAL: Get PROFILE username (single source of truth)
    // The PROFILE username is what the user sees in settings and is the authoritative username
    let profileUsername = null;
    if (requestedUserEmail) {
      try {
        const profileParams = {
          TableName: table,
          Key: {
            PK: `USER#${requestedUserEmail}`,
            SK: 'PROFILE'
          }
        };
        const profileResult = await dynamodb.get(profileParams).promise();
        if (profileResult.Item && profileResult.Item.username) {
          profileUsername = profileResult.Item.username;
          console.log(`✅ [request-follow] Found PROFILE username: "${profileUsername}" (single source of truth)`);
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
    
    console.log(`✅ [request-follow] Found user: ${usernameToUse} (email: ${requestedUserEmail}, visibility: ${visibility})`);

    // CRITICAL: Check if this is a private stream request
    // Can be indicated by: 1) isPrivateStreamRequest parameter from frontend, or 2) 🔒 in username (legacy)
    // Private stream requests should ALWAYS create a FOLLOW_REQUEST, never auto-accept
    // Public account requests should check PROFILE visibility
    const isPrivateStreamRequestFromParam = isPrivateStreamRequest === true || isPrivateStreamRequest === 'true';
    const isPrivateStreamRequestFromUsername = requestedUsername.includes('🔒');
    const isPrivateStreamRequestFinal = isPrivateStreamRequestFromParam || isPrivateStreamRequestFromUsername;

    console.log(`🔍 [request-follow] Username analysis: requested='${cleanRequestedUsername}', PROFILE='${usernameToUse}', isPrivateStreamRequest=${isPrivateStreamRequestFinal}`);

    // If this is a private stream request, always create FOLLOW_REQUEST
    if (isPrivateStreamRequestFinal) {
      console.log(`🔒 [request-follow] Private stream request detected - creating FOLLOW_REQUEST`);
      // Skip auto-accept logic and go directly to FOLLOW_REQUEST creation below
    } else if (visibility === 'public') {
      // Only auto-accept if it's a public account request (no 🔒) AND profile is public
      console.log(`✅ [request-follow] Public account request (no 🔒) and profile is public - auto-accepting`);
      
      // Check if already added
      const existingAddedParams = {
        TableName: table,
        Key: {
          PK: `USER#${requesterEmail}`,
          SK: `ADDED_USERNAME#${requestedUserEmail}`
        }
      };
      const existingAdded = await dynamodb.get(existingAddedParams).promise();
      
      if (existingAdded.Item) {
        return {
          success: false,
          message: 'User already added to timeline',
          status: 'active',
          autoAccepted: true
        };
      }
      
      // Add username to requester's timeline
      const addParams = {
        TableName: table,
        Item: {
          PK: `USER#${requesterEmail}`,
          SK: `ADDED_USERNAME#${requestedUserEmail}`,
          status: 'active',
          addedAt: new Date().toISOString(),
          streamerUsername: usernameToUse, // ALWAYS use PROFILE username (single source of truth)
          streamerEmail: requestedUserEmail,
          streamerVisibility: 'public',
          autoAccepted: true
        }
      };

      await dynamodb.put(addParams).promise();

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

    // Get requester's username (use provided from frontend, or empty string)
    // Frontend should always pass requesterUsername from authService.username
    // If not provided, use empty string (no lookup to avoid delays/errors)
    const requesterUsernameForRequest = requesterUsername || '';
    
    if (requesterUsernameForRequest) {
      console.log(`✅ [request-follow] Using requester username from request: ${requesterUsernameForRequest}`);
    } else {
      console.log(`⚠️ [request-follow] Requester username not provided, will store as empty string`);
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
