import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

export default defineEventHandler(async (event) => {
  // Configure AWS
  AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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',
    region: 'us-east-1'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  // ISOLATED MESSAGING TABLE - separate from main Twilly table
  const messagingTable = process.env.MESSAGING_TABLE || 'TwillyMessaging';
  // Main Twilly table for video lookups only
  const mainTable = 'Twilly';

  try {
    const body = await readBody(event);
    const { videoId, userId, username, text, parentCommentId, creatorEmail, commenterEmail } = body;

    // COMPREHENSIVE LOGGING: Log incoming payload
    console.log(`\n📥 [comments/post] ========== INCOMING PAYLOAD ==========`);
    console.log(`   videoId: ${videoId}`);
    console.log(`   userId: ${userId}`);
    console.log(`   username: ${username}`);
    console.log(`   text: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    console.log(`   parentCommentId: ${parentCommentId || 'NULL'}`);
    console.log(`   creatorEmail: ${creatorEmail || 'NULL'}`);
    console.log(`   commenterEmail: ${commenterEmail || 'NULL'}`);
    console.log(`================================================\n`);

    if (!videoId || !userId || !username || !text) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: videoId, userId, username, text'
      });
    }

    if (text.trim().length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Comment text cannot be empty'
      });
    }

    if (text.length > 500) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Comment text cannot exceed 500 characters'
      });
    }

    // Parse @username mentions to detect private replies
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]); // Extract username without @
    }

    // Determine if this is a private reply
    // If parentCommentId is provided OR @username is mentioned, it's a private thread
    const isPrivate = parentCommentId != null || mentions.length > 0;
    console.log(`🔍 [comments/post] Determining if private: parentCommentId=${parentCommentId != null}, mentions=${mentions.length}, isPrivate=${isPrivate}`);
    
    // Get video owner email for visibility checks
    // CRITICAL: Use multiple methods to ensure we NEVER fail to get videoOwnerEmail
    let videoOwnerEmail = null;
    
    // METHOD 1: Use creatorEmail if provided (fastest, most reliable)
    if (creatorEmail) {
      videoOwnerEmail = creatorEmail.toLowerCase();
      console.log(`✅ [comments/post] Video owner email from creatorEmail: ${videoOwnerEmail}`);
    } else {
      // METHOD 2: Get from existing comments (FASTEST - uses query, not scan, and comments always have videoOwnerEmail)
      // This is the PRIMARY fallback because it's faster and more reliable than scanning for video entry
      console.log(`🔍 [comments/post] Looking up video owner from existing comments (fastest method)`);
      
      // Normalize videoId for query
      let normalizedVideoIdForQuery = videoId;
      if (normalizedVideoIdForQuery.startsWith('FILE#')) {
        normalizedVideoIdForQuery = normalizedVideoIdForQuery.replace('FILE#', '');
      }
      if (normalizedVideoIdForQuery.startsWith('file-')) {
        normalizedVideoIdForQuery = normalizedVideoIdForQuery.replace('file-', '');
      }
      
      // Try both PK formats (with and without file- prefix) to handle legacy comments
      const pkFormats = [
        `VIDEO#${normalizedVideoIdForQuery}`,
        `VIDEO#file-${normalizedVideoIdForQuery}` // Legacy format
      ];
      
      for (const pk of pkFormats) {
        try {
          // Query existing comments - they all store videoOwnerEmail
          const commentQueryParams = {
            TableName: messagingTable,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': pk,
              ':sk': 'COMMENT#'
            },
            Limit: 1, // Only need one comment to get videoOwnerEmail
            ConsistentRead: false // Don't need latest, just need any comment
          };
          const commentResult = await dynamodb.query(commentQueryParams).promise();
          
          if (commentResult.Items && commentResult.Items.length > 0) {
            const existingComment = commentResult.Items[0];
            if (existingComment.videoOwnerEmail) {
              videoOwnerEmail = existingComment.videoOwnerEmail.toLowerCase();
              console.log(`✅ [comments/post] Video owner email from existing comment (PK: ${pk}): ${videoOwnerEmail}`);
              break; // Found it, stop trying other formats
            }
          }
        } catch (err) {
          console.error(`⚠️ [comments/post] Error querying existing comments (PK: ${pk}): ${err.message}`);
        }
      }
      
      // METHOD 3: If still not found, try video entry lookup (slower, but necessary if no comments exist yet)
      if (!videoOwnerEmail) {
        console.log(`🔍 [comments/post] No existing comments found, trying video entry lookup`);
        const fileId = videoId.startsWith('FILE#') ? videoId.replace('FILE#', '') : videoId;
        
        // Try multiple SK formats to handle different video entry formats
        const skFormats = [
          `FILE#${fileId}`,
          fileId,
          `FILE#file-${fileId}` // Handle case where fileId already has file- prefix
        ];
        
        for (const searchSK of skFormats) {
          try {
            const videoScanParams = {
              TableName: mainTable,
              FilterExpression: 'SK = :sk',
              ExpressionAttributeValues: { ':sk': searchSK },
              Limit: 1
            };
            const videoResult = await dynamodb.scan(videoScanParams).promise();
            if (videoResult.Items && videoResult.Items.length > 0) {
              const ownerPK = videoResult.Items[0].PK;
              if (ownerPK) {
                videoOwnerEmail = ownerPK.replace('USER#', '').toLowerCase();
                console.log(`✅ [comments/post] Video owner email from video entry (SK: ${searchSK}): ${videoOwnerEmail}`);
                break; // Found it, stop trying other formats
              }
            }
          } catch (err) {
            console.error(`⚠️ [comments/post] Error scanning for video entry (SK: ${searchSK}): ${err.message}`);
          }
        }
      }
    }
    
    // CRITICAL: Final validation - videoOwnerEmail MUST be set
    if (!videoOwnerEmail) {
      console.error(`❌ [comments/post] CRITICAL ERROR: videoOwnerEmail is NULL after all lookup methods!`);
      console.error(`   videoId: ${videoId}`);
      console.error(`   creatorEmail: ${creatorEmail || 'not provided'}`);
      console.error(`   This will cause notifications and unread counts to fail!`);
      // Don't throw error - allow comment to be posted, but log critical error
      // The unread-count API has fallbacks to handle this case
    } else {
      console.log(`✅ [comments/post] Final videoOwnerEmail: ${videoOwnerEmail}`);
    }

    // Determine visibleTo array for private threads
    let visibleTo = [];
    
    // CRITICAL: Get parentCommenterEmail early so it's available for visibleTo population
    let parentCommenterEmail = null;
    if (isPrivate && parentCommentId) {
      // Get parent comment to find the original commenter's email
      try {
        // Normalize videoId for query
        let normalizedVideoIdForQuery = videoId;
        if (normalizedVideoIdForQuery.startsWith('FILE#')) {
          normalizedVideoIdForQuery = normalizedVideoIdForQuery.replace('FILE#', '');
        }
        if (normalizedVideoIdForQuery.startsWith('file-')) {
          normalizedVideoIdForQuery = normalizedVideoIdForQuery.replace('file-', '');
        }
        
        const parentQueryParams = {
          TableName: messagingTable,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          FilterExpression: 'commentId = :commentId',
          ExpressionAttributeValues: {
            ':pk': `VIDEO#${normalizedVideoIdForQuery}`,
            ':sk': 'COMMENT#',
            ':commentId': parentCommentId
          },
          Limit: 1
        };
        let parentResult = await dynamodb.query(parentQueryParams).promise();
        
        // If not found, try scan as fallback
        if (!parentResult.Items || parentResult.Items.length === 0) {
          const parentScanParams = {
            TableName: messagingTable,
            FilterExpression: 'PK = :pk AND commentId = :commentId',
            ExpressionAttributeValues: {
              ':pk': `VIDEO#${normalizedVideoIdForQuery}`,
              ':commentId': parentCommentId
            },
            Limit: 1
          };
          parentResult = await dynamodb.scan(parentScanParams).promise();
        }
        
        if (parentResult.Items && parentResult.Items.length > 0) {
          const parentComment = parentResult.Items[0];
          const parentUserId = parentComment.userId;
          if (parentUserId) {
            if (parentUserId.includes('@')) {
              parentCommenterEmail = parentUserId.toLowerCase();
            } else {
              try {
                const parentProfileParams = {
                  TableName: mainTable,
                  Key: {
                    PK: `USER#${parentUserId}`,
                    SK: 'PROFILE'
                  }
                };
                const parentProfileResult = await dynamodb.get(parentProfileParams).promise();
                if (parentProfileResult.Item) {
                  parentCommenterEmail = (parentProfileResult.Item.email || parentProfileResult.Item.userEmail || parentUserId).toLowerCase();
                }
              } catch (err) {
                console.error(`⚠️ [comments/post] Could not resolve parent commenter email: ${err.message}`);
              }
            }
          }
        }
      } catch (err) {
        console.error(`⚠️ [comments/post] Error querying for parent comment: ${err.message}`);
      }
    }
    
    if (isPrivate) {
      // Get current commenter's email (the person posting this message)
      // CRITICAL: Frontend now sends userEmail as userId - no lookup needed!
      let currentCommenterEmail = null;
      if (userId.includes('@')) {
        // userId is an email (frontend sends userEmail as userId)
        currentCommenterEmail = userId.toLowerCase();
        console.log(`✅ [comments/post] Sender email from userId: ${currentCommenterEmail}`);
      } else {
        // Fallback: userId is still UUID (old clients) - lookup email using username via GSI
        console.log(`⚠️ [comments/post] userId is UUID (old client) - resolving email for username: ${username}`);
        try {
          let usernameResult = null;
          try {
            const gsiParams = {
              TableName: mainTable,
              IndexName: 'UsernameSearchIndex',
              KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
              ExpressionAttributeValues: {
                ':visibility': 'public',
                ':username': username
              },
              Limit: 1
            };
            usernameResult = await dynamodb.query(gsiParams).promise();
          } catch (err) {
            try {
              const gsiParamsPrivate = {
                TableName: mainTable,
                IndexName: 'UsernameSearchIndex',
                KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
                ExpressionAttributeValues: {
                  ':visibility': 'private',
                  ':username': username
                },
                Limit: 1
              };
              usernameResult = await dynamodb.query(gsiParamsPrivate).promise();
            } catch (err2) {
              console.error(`⚠️ [comments/post] GSI lookup failed: ${err2.message}`);
            }
          }
          
          if (usernameResult && usernameResult.Items && usernameResult.Items.length > 0) {
            const profile = usernameResult.Items[0];
            currentCommenterEmail = profile.email || profile.userEmail || (profile.PK ? profile.PK.replace('USER#', '') : null);
            if (currentCommenterEmail) {
              currentCommenterEmail = currentCommenterEmail.toLowerCase();
              console.log(`✅ [comments/post] Resolved sender email from username GSI: ${currentCommenterEmail}`);
            }
          }
        } catch (err) {
          console.error(`⚠️ [comments/post] Error resolving email from username: ${err.message}`);
        }
      }
      
      // Private threads are visible to: video owner + commenter + current commenter
      if (videoOwnerEmail) {
        visibleTo.push(videoOwnerEmail);
      }
      
      // Always include the current commenter (the person posting) so they can see their own messages
      if (currentCommenterEmail && !visibleTo.includes(currentCommenterEmail)) {
        visibleTo.push(currentCommenterEmail);
      }
      
      // SIMPLIFIED: Private chat = general chat with a room identifier
      // Track participants naturally - whoever posts is automatically a participant
      // Use parentCommentId as the room identifier (threadId)
      if (parentCommentId) {
        // Normalize videoId for thread lookup
        let normalizedVideoIdForThread = videoId;
        if (normalizedVideoIdForThread.startsWith('FILE#')) {
          normalizedVideoIdForThread = normalizedVideoIdForThread.replace('FILE#', '');
        }
        if (normalizedVideoIdForThread.startsWith('file-')) {
          normalizedVideoIdForThread = normalizedVideoIdForThread.replace('file-', '');
        }
        
        // Get ALL messages in this room (thread) - SIMPLE: just query by parentCommentId
        const threadQueryParams = {
          TableName: messagingTable,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          FilterExpression: 'parentCommentId = :parentId OR commentId = :parentId',
          ExpressionAttributeValues: {
            ':pk': `VIDEO#${normalizedVideoIdForThread}`,
            ':sk': 'COMMENT#',
            ':parentId': parentCommentId
          }
        };
        const threadResult = await dynamodb.query(threadQueryParams).promise();
        const allThreadMessages = threadResult.Items || [];
        console.log(`🔍 [comments/post] Found ${allThreadMessages.length} messages in room ${parentCommentId}`);
        
        // SIMPLIFIED: Collect participants naturally - whoever posted is a participant
        const allParticipants = new Set();
        
        // Add all message authors (whoever posted is automatically a participant)
        for (const message of allThreadMessages) {
          let messageAuthorEmail = null;
          if (message.userId) {
            if (message.userId.includes('@')) {
              messageAuthorEmail = message.userId.toLowerCase();
            } else {
              // Try to get email from profile
              try {
                const authorProfileParams = {
                  TableName: messagingTable,
                  Key: {
                    PK: `USER#${message.userId}`,
                    SK: 'PROFILE'
                  }
                };
                const authorProfileResult = await dynamodb.get(authorProfileParams).promise();
                if (authorProfileResult.Item) {
                  messageAuthorEmail = (authorProfileResult.Item.email || authorProfileResult.Item.userEmail || null);
                  if (messageAuthorEmail) {
                    messageAuthorEmail = messageAuthorEmail.toLowerCase();
                  }
                }
              } catch (err) {
                // Fallback to mainTable
                try {
                  const authorProfileParams = {
                    TableName: mainTable,
                    Key: {
                      PK: `USER#${message.userId}`,
                      SK: 'PROFILE'
                    }
                  };
                  const authorProfileResult = await dynamodb.get(authorProfileParams).promise();
                  if (authorProfileResult.Item) {
                    messageAuthorEmail = (authorProfileResult.Item.email || authorProfileResult.Item.userEmail || null);
                    if (messageAuthorEmail) {
                      messageAuthorEmail = messageAuthorEmail.toLowerCase();
                    }
                  }
                } catch (err2) {
                  console.error(`⚠️ [comments/post] Could not resolve author email: ${err2.message}`);
                }
              }
            }
            
            if (messageAuthorEmail) {
              allParticipants.add(messageAuthorEmail);
            }
          }
          
          // Also add from visibleTo (backward compatibility)
          // CRITICAL: Only add emails (not UUIDs) - filter out UUIDs
          if (message.visibleTo && Array.isArray(message.visibleTo)) {
            for (const email of message.visibleTo) {
              if (email && typeof email === 'string') {
                // Only add if it's an email (contains @), not a UUID
                if (email.includes('@')) {
                allParticipants.add(email.toLowerCase());
                } else {
                  console.log(`   ⚠️ Skipping UUID in visibleTo: ${email} (not an email)`);
                }
              }
            }
          }
        }
        
        // Add current commenter (the person posting now)
        if (currentCommenterEmail) {
          allParticipants.add(currentCommenterEmail);
        }
        
        // Add commenterEmail if provided (the person being messaged)
        if (commenterEmail) {
          allParticipants.add(commenterEmail.toLowerCase());
        }
        
        // Add video owner (they should see all conversations on their video)
        if (videoOwnerEmail) {
          allParticipants.add(videoOwnerEmail);
        }
        
        // CRITICAL: Set visibleTo to ALL participants (simple - everyone in the room sees everything)
        // This ensures BOTH participants are always included, so notifications go both directions
        // CRITICAL: Filter out any UUIDs - only keep emails (UUIDs don't have @)
        visibleTo = Array.from(allParticipants).filter(email => email && typeof email === 'string' && email.includes('@'));
        
        // CRITICAL FIX: Ensure BOTH participants are always in visibleTo for bidirectional visibility
        // If we only have one participant, something is wrong - add the other participant
        if (visibleTo.length === 1 && parentCommenterEmail && currentCommenterEmail) {
          // Only one participant found - add the other one (only if they're emails, not UUIDs)
          if (parentCommenterEmail.includes('@') && !visibleTo.includes(parentCommenterEmail.toLowerCase())) {
            visibleTo.push(parentCommenterEmail.toLowerCase());
            console.log(`   ⚠️ [comments/post] Only one participant found, added parent commenter: ${parentCommenterEmail.toLowerCase()}`);
          }
          if (currentCommenterEmail.includes('@') && !visibleTo.includes(currentCommenterEmail)) {
            visibleTo.push(currentCommenterEmail);
            console.log(`   ⚠️ [comments/post] Only one participant found, added current commenter: ${currentCommenterEmail}`);
          }
        }
        
        // Ensure video owner is always included (they should see all conversations on their video)
        // Only add if it's an email (not a UUID)
        if (videoOwnerEmail && videoOwnerEmail.includes('@') && !visibleTo.includes(videoOwnerEmail.toLowerCase())) {
          visibleTo.push(videoOwnerEmail.toLowerCase());
        }
        
        // CRITICAL: Final validation - ensure all items in visibleTo are emails (not UUIDs)
        visibleTo = visibleTo.filter(email => email && typeof email === 'string' && email.includes('@'));
        console.log(`   ✅ Final visibleTo (emails only): [${visibleTo.join(', ')}] (${visibleTo.length} participants)`);
        
        // CRITICAL FIX: Ensure visibleTo is never empty for private messages
        // If allParticipants is empty (email resolution failed), fallback to basic participants
        if (visibleTo.length === 0) {
          console.log(`⚠️ [comments/post] allParticipants is empty for thread ${parentCommentId}, using fallback`);
          if (currentCommenterEmail) {
            visibleTo.push(currentCommenterEmail);
          }
          if (videoOwnerEmail && !visibleTo.includes(videoOwnerEmail)) {
            visibleTo.push(videoOwnerEmail);
          }
          // Safety check: parentCommenterEmail should be defined at function level, but check just in case
          if (typeof parentCommenterEmail !== 'undefined' && parentCommenterEmail && !visibleTo.includes(parentCommenterEmail)) {
            visibleTo.push(parentCommenterEmail);
          }
        }
        
        console.log(`👥 [comments/post] Room ${parentCommentId} participants: ${visibleTo.join(', ')}`);
      } else if (commenterEmail) {
        // Starting a new conversation - include both participants
        const normalizedCommenterEmail = commenterEmail.toLowerCase();
        if (currentCommenterEmail && !visibleTo.includes(currentCommenterEmail)) {
          visibleTo.push(currentCommenterEmail);
        }
        if (!visibleTo.includes(normalizedCommenterEmail)) {
          visibleTo.push(normalizedCommenterEmail);
        }
        // Include video owner
        if (videoOwnerEmail && !visibleTo.includes(videoOwnerEmail)) {
          visibleTo.push(videoOwnerEmail);
        }
      } else {
        // Self-messaging: if no commenterEmail, allow messaging yourself
        // Just include current commenter and video owner
        if (currentCommenterEmail && !visibleTo.includes(currentCommenterEmail)) {
          visibleTo.push(currentCommenterEmail);
        }
        if (videoOwnerEmail && !visibleTo.includes(videoOwnerEmail)) {
          visibleTo.push(videoOwnerEmail);
        }
      }
      
      // CRITICAL FIX: Final safety check - ensure visibleTo is never empty for private messages
      // ALWAYS include both participants - this is non-negotiable for private messages
      if (isPrivate && visibleTo.length === 0) {
        console.log(`⚠️ [comments/post] visibleTo is empty for private message, using emergency fallback`);
        
        // Method 1: Try to get sender email from username (reverse lookup) - USE GSI!
        if (!currentCommenterEmail && username) {
          try {
            // CRITICAL: Use GSI instead of scan for fast lookup
            // Try public first (most common)
            let usernameResult = null;
            try {
              const gsiParams = {
                TableName: mainTable,
                IndexName: 'UsernameSearchIndex',
                KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
                ExpressionAttributeValues: {
                  ':visibility': 'public',
                  ':username': username
                },
                Limit: 1
              };
              usernameResult = await dynamodb.query(gsiParams).promise();
            } catch (gsiError) {
              // GSI might not exist or username might be private, try private visibility
              try {
                const gsiParams = {
                  TableName: mainTable,
                  IndexName: 'UsernameSearchIndex',
                  KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
                  ExpressionAttributeValues: {
                    ':visibility': 'private',
                    ':username': username
                  },
                  Limit: 1
                };
                usernameResult = await dynamodb.query(gsiParams).promise();
              } catch (gsiError2) {
                console.error(`   ⚠️ GSI lookup failed (both public/private): ${gsiError2.message}`);
              }
            }
            
            if (usernameResult && usernameResult.Items && usernameResult.Items.length > 0) {
              const profile = usernameResult.Items[0];
              // Extract email from PK (USER#email) or from profile fields
              currentCommenterEmail = profile.email || profile.userEmail || (profile.PK ? profile.PK.replace('USER#', '') : null);
              if (currentCommenterEmail) {
                currentCommenterEmail = currentCommenterEmail.toLowerCase();
                console.log(`   ✅ Resolved sender email from username via GSI: ${currentCommenterEmail}`);
              }
            } else {
              console.log(`   ⚠️ Username not found in GSI: ${username}`);
            }
          } catch (err) {
            console.error(`   ⚠️ Could not resolve email from username: ${err.message}`);
          }
        }
        
        // Add sender
        if (currentCommenterEmail) {
          visibleTo.push(currentCommenterEmail);
        }
        
        // Add parent commenter (the other participant in the thread)
        if (parentCommenterEmail && !visibleTo.includes(parentCommenterEmail)) {
          visibleTo.push(parentCommenterEmail);
        }
        
        // Add video owner (they should see all conversations on their video)
        if (videoOwnerEmail && !visibleTo.includes(videoOwnerEmail)) {
          visibleTo.push(videoOwnerEmail);
        }
        
        // If still empty, use commenterEmail from request body
        if (visibleTo.length === 0 && commenterEmail) {
          visibleTo.push(commenterEmail.toLowerCase());
        }
        
        // LAST RESORT: If still empty, this is a critical error
        if (visibleTo.length === 0) {
          console.error(`❌ [comments/post] CRITICAL: visibleTo is STILL empty after all fallbacks!`);
          console.error(`   Username: ${username}`);
          console.error(`   UserId: ${userId}`);
          console.error(`   ParentCommentId: ${parentCommentId}`);
          console.error(`   CommenterEmail: ${commenterEmail}`);
          console.error(`   VideoOwnerEmail: ${videoOwnerEmail}`);
          // Still set to at least video owner if available, otherwise fail
          if (videoOwnerEmail) {
            visibleTo.push(videoOwnerEmail);
            console.error(`   ⚠️ Using video owner as last resort: ${videoOwnerEmail}`);
          }
        }
        
        console.log(`   ✅ Emergency fallback visibleTo: [${visibleTo.join(', ')}] (${visibleTo.length} participants)`);
      }
      
      // FINAL CHECK: Ensure visibleTo has at least 2 participants for private messages (sender + recipient)
      // This ensures both parties can see the conversation
      if (isPrivate && visibleTo.length > 0) {
        console.log(`✅ [comments/post] Private message visibleTo: [${visibleTo.join(', ')}] (${visibleTo.length} participants)`);
      } else if (isPrivate) {
        console.error(`❌ [comments/post] CRITICAL ERROR: Private message has empty visibleTo! This should never happen.`);
      }
    }

    console.log(`📝 [comments/post] Posting ${isPrivate ? 'private' : 'public'} comment on video: ${videoId} by ${username}${parentCommentId ? ` (reply to ${parentCommentId})` : ''}`);

    // Normalize videoId - strip FILE# prefix if present to ensure consistent PK format
    // Normalize videoId - strip FILE# or file- prefix if present to ensure consistent PK format
    let normalizedVideoId = videoId;
    if (normalizedVideoId.startsWith('FILE#')) {
      normalizedVideoId = normalizedVideoId.replace('FILE#', '');
    }
    if (normalizedVideoId.startsWith('file-')) {
      normalizedVideoId = normalizedVideoId.replace('file-', '');
    }
    console.log(`🔧 [comments/post] Normalized videoId: "${videoId}" -> "${normalizedVideoId}"`);

    // Generate comment ID and timestamp
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();
    const sortKey = `COMMENT#${Date.now()}_${commentId}`; // Sortable by timestamp

    // Create comment item
    const commentItem = {
      PK: `VIDEO#${normalizedVideoId}`,
      SK: sortKey,
      commentId: commentId,
      videoId: normalizedVideoId,
      userId: userId,
      username: username,
      text: text.trim(),
      createdAt: timestamp,
      timestamp: timestamp,
      likeCount: 0,
      isLiked: false,
      status: 'ACTIVE',
      isPrivate: isPrivate,
      parentCommentId: parentCommentId || null,
      // CRITICAL: NEVER set visibleTo to null for private messages - always include participants
      // If visibleTo is empty for private messages, this is a critical error
      visibleTo: isPrivate ? (visibleTo.length > 0 ? visibleTo : []) : (visibleTo.length > 0 ? visibleTo : null),
      mentionedUsername: mentions.length > 0 ? mentions[0] : null, // Store first mention
      // Store video owner email for fast ownership checks (NO SCAN needed!)
      videoOwnerEmail: videoOwnerEmail ? videoOwnerEmail.toLowerCase() : null
    };

    // Save to ISOLATED MESSAGING TABLE
    await dynamodb.put({
      TableName: messagingTable,
      Item: commentItem
    }).promise();

    console.log(`✅ [comments/post] Comment posted successfully: ${commentId}`);

    // CRITICAL: After posting, send unread_count_update to recipient(s) via WebSocket
    // This triggers indicator and orange highlight immediately (fast, no polling needed)
    // Similar to mark-thread-read flow - calculate unread counts and push via WebSocket
    if (isPrivate && visibleTo.length > 0) {
      try {
        // Get all participants (recipients) - exclude sender
        const senderEmail = userId.toLowerCase();
        const recipients = visibleTo
          .map(email => email.toLowerCase())
          .filter(email => email !== senderEmail && email.includes('@'));
        
        if (recipients.length > 0) {
          console.log(`📡 [comments/post] Calculating and sending unread_count_update to recipients: ${recipients.join(', ')}`);
          
          const { sendWebSocketNotification } = await import('../../utils/websocket-cache.js');
          const websocketApiEndpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                                      process.env.WSS_ENDPOINT ||
                                      'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';
          
          // For each recipient, calculate their unread counts (inline calculation, fast)
          await Promise.all(recipients.map(async (recipientEmail) => {
            try {
              // Query all comments for this video to calculate unread counts
              const commentsParams = {
                TableName: messagingTable,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                  ':pk': `VIDEO#${normalizedVideoId}`,
                  ':sk': 'COMMENT#'
                },
                ConsistentRead: true // Get latest data including the message we just posted
              };
              const commentsResult = await dynamodb.query(commentsParams).promise();
              const allComments = commentsResult.Items || [];
              
              // Get thread view timestamps for this recipient
              const threadViewParams = {
                TableName: messagingTable,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: {
                  ':pk': `USER#${recipientEmail}`,
                  ':sk': `THREAD_VIEW#${normalizedVideoId}#`
                }
              };
              const threadViewResult = await dynamodb.query(threadViewParams).promise();
              const threadViews = threadViewResult.Items || [];
              
              // Build map of threadId -> lastViewedAt
              const threadLastViewedMap = {};
              for (const view of threadViews) {
                const threadId = view.threadId || view.SK.split('#')[2];
                if (threadId && view.lastViewedAt) {
                  threadLastViewedMap[threadId] = new Date(view.lastViewedAt);
                }
              }
              
              // Check if recipient is video owner
              let isOwner = false;
              if (allComments.length > 0) {
                const commentWithOwner = allComments.find(c => 
                  c.videoOwnerEmail && 
                  c.videoOwnerEmail.toLowerCase() === recipientEmail
                );
                if (commentWithOwner) {
                  isOwner = true;
                }
              }
              
              // Calculate unread counts
              let totalUnread = 0;
              const threadUnreadCounts = {};
              
              for (const comment of allComments) {
                const commentDate = new Date(comment.createdAt || comment.timestamp || 0);
                const isPrivateMsg = comment.isPrivate === true;
                const commentVisibleTo = comment.visibleTo || [];
                const isParticipant = commentVisibleTo.some(email => email.toLowerCase() === recipientEmail);
                
                // Get commenter email
                let commenterEmail = null;
                if (comment.userId && comment.userId.includes('@')) {
                  commenterEmail = comment.userId.toLowerCase();
                }
                const isViewerSender = commenterEmail === recipientEmail;
                
                // Count unread private messages
                if (isPrivateMsg && (isParticipant || isOwner) && !isViewerSender) {
                  const parentId = comment.parentCommentId || comment.commentId || comment.SK.replace('COMMENT#', '');
                  const threadLastViewed = threadLastViewedMap[parentId] || null;
                  const isUnread = !threadLastViewed || commentDate > threadLastViewed;
                  
                  if (isUnread) {
                    totalUnread++;
                    if (!threadUnreadCounts[parentId]) {
                      threadUnreadCounts[parentId] = 0;
                    }
                    threadUnreadCounts[parentId]++;
                  }
                }
              }
              
              // Send unread_count_update WebSocket notification
              await sendWebSocketNotification(
                [recipientEmail],
                'unread_count_update',
                {
                  videoId: normalizedVideoId,
                  totalUnread: totalUnread,
                  threadUnreadCounts: threadUnreadCounts
                },
                websocketApiEndpoint,
                true // Lambda fallback
              );
              
              console.log(`✅ [comments/post] Sent unread_count_update to ${recipientEmail}: total=${totalUnread}, threads=${Object.keys(threadUnreadCounts).length}`);
            } catch (err) {
              console.error(`⚠️ [comments/post] Error sending unread_count_update to ${recipientEmail}: ${err.message}`);
            }
          }));
        }
      } catch (error) {
        console.error(`⚠️ [comments/post] Error in unread_count_update flow: ${error.message}`);
        // Don't fail the post if WebSocket notification fails
      }
    }

    // SUPER SIMPLE: Use usernames to find emails, send notification to the one who didn't post
    // CRITICAL: This MUST run for ALL private messages
    if (isPrivate) {
      try {
        console.log(`🔍 [comments/post] ========== CHECKING NOTIFICATION CREATION ==========`);
        console.log(`   isPrivate: ${isPrivate}`);
        console.log(`   parentCommentId: ${parentCommentId || 'NULL'}`);
        console.log(`   username: ${username}`);
        console.log(`   commentId: ${commentId}`);
        console.log(`   normalizedVideoId: ${normalizedVideoId}`);
        
        if (!parentCommentId) {
          // New thread - use commenterEmail from request body
          console.log(`   ⚠️ No parentCommentId - this is a NEW thread, using commenterEmail`);
          
          // CRITICAL: Only send notification to recipient, NEVER to sender
          const senderEmail = userId.toLowerCase();
          const recipientEmail = commenterEmail ? commenterEmail.toLowerCase() : null;
          
          // Safety check: Don't send notification to sender
          if (recipientEmail && recipientEmail !== senderEmail) {
            const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const notificationParams = {
              TableName: mainTable,
              Item: {
                PK: `USER#${recipientEmail}`,
                SK: `NOTIFICATION#${notificationId}`,
                type: 'private_message',
                title: 'New Private Message',
                message: `${username} sent you a private message`,
                metadata: {
                  videoId: normalizedVideoId,
                  threadId: commentId,
                  senderUsername: username,
                  senderEmail: senderEmail,
                  recipientEmail: recipientEmail
                },
                isRead: false,
                createdAt: new Date().toISOString()
              }
            };
            await dynamodb.put(notificationParams).promise();
            console.log(`✅ [comments/post] Created notification for NEW thread: ${recipientEmail} (sender: ${senderEmail})`);
            
            // CRITICAL: Send WebSocket notification so recipient sees indicator immediately
            try {
              const { sendWebSocketNotification } = await import('../../utils/websocket-cache.js');
              const websocketApiEndpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                                          process.env.WSS_ENDPOINT ||
                                          'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';
              
              await sendWebSocketNotification(
                [recipientEmail],
                'inboxNotification', // Use inboxNotification to trigger checkPrivateMessageNotifications
                {
                  notificationType: 'private_message',
                  notificationId: notificationId,
                  title: notificationParams.Item.title,
                  message: notificationParams.Item.message,
                  metadata: notificationParams.Item.metadata
                },
                websocketApiEndpoint,
                true // Lambda fallback
              );
              console.log(`📡 [comments/post] WebSocket inboxNotification sent to ${recipientEmail}`);
            } catch (wsError) {
              console.error(`⚠️ [comments/post] Failed to send WebSocket notification: ${wsError.message}`);
              // Continue - WebSocket is non-blocking
            }
          } else if (recipientEmail === senderEmail) {
            console.log(`⚠️ [comments/post] Skipping notification - recipient is the sender (${recipientEmail})`);
          } else {
            console.error(`❌ [comments/post] No valid commenterEmail for new thread notification`);
          }
        } else {
          // Existing thread - find other participant
          // SUPER SIMPLE: Get ALL participants in thread, find the one who didn't post
          const senderUsername = username;
          const senderEmail = userId.toLowerCase();
          console.log(`🔔 [comments/post] Creating private_message notification for EXISTING thread...`);
          console.log(`   Sender username: ${senderUsername}`);
          console.log(`   Sender email: ${senderEmail}`);
          console.log(`   ParentCommentId: ${parentCommentId}`);
          console.log(`   NormalizedVideoId: ${normalizedVideoId}`);
          
          // Get ALL participants in the thread to find the OTHER one
          let otherParticipantUsername = null;
          let allParticipants = new Set();
          
          try {
            // Get parent comment first
            const parentQueryParams = {
              TableName: messagingTable,
              KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
              FilterExpression: 'commentId = :commentId',
              ExpressionAttributeValues: {
                ':pk': `VIDEO#${normalizedVideoId}`,
                ':sk': 'COMMENT#',
                ':commentId': parentCommentId
              },
              Limit: 1
            };
            const parentResult = await dynamodb.query(parentQueryParams).promise();
            
            // Add parent comment username
            if (parentResult.Items && parentResult.Items.length > 0) {
              const parentComment = parentResult.Items[0];
              if (parentComment.username) {
                allParticipants.add(parentComment.username);
                console.log(`   Parent comment participant: ${parentComment.username}`);
              }
            }
            
            // Get ALL replies in this thread
            const threadQueryParams = {
              TableName: messagingTable,
              KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
              FilterExpression: 'parentCommentId = :parentId',
              ExpressionAttributeValues: {
                ':pk': `VIDEO#${normalizedVideoId}`,
                ':sk': 'COMMENT#',
                ':parentId': parentCommentId
              }
            };
            const threadResult = await dynamodb.query(threadQueryParams).promise();
            console.log(`   Found ${threadResult.Items.length} reply messages in thread`);
            
            // Collect ALL unique usernames in the thread (parent + all replies)
            for (const msg of threadResult.Items || []) {
              const msgUsername = msg.username;
              if (msgUsername) {
                allParticipants.add(msgUsername);
                console.log(`   Reply participant: ${msgUsername}`);
              }
            }
            
            // Find the OTHER participant (not the sender)
            for (const participant of allParticipants) {
              if (participant !== senderUsername) {
                otherParticipantUsername = participant;
                console.log(`   ✅ Found other participant: ${otherParticipantUsername} (sender: ${senderUsername})`);
                break;
              }
            }
            
            if (!otherParticipantUsername) {
              console.error(`❌ [comments/post] No other participant found in thread!`);
              console.error(`   All participants: ${Array.from(allParticipants).join(', ')}`);
              console.error(`   Sender: ${senderUsername}`);
            }
          } catch (err) {
            console.error(`⚠️ [comments/post] Error finding other participant: ${err.message}`);
            console.error(`   Stack: ${err.stack}`);
          }
          
          // If we found the other participant, lookup their email and send notification
          if (otherParticipantUsername) {
            console.log(`   Other participant username: ${otherParticipantUsername}`);
            
            // Lookup email from username using GSI - ROBUST: Try multiple methods
            let recipientEmail = null;
            
            // Normalize username (trim, remove special chars that might cause issues)
            const normalizedUsername = otherParticipantUsername.trim();
            
            // METHOD 1: Try GSI with public visibility
            try {
              const gsiParams = {
                TableName: mainTable,
                IndexName: 'UsernameSearchIndex',
                KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
                ExpressionAttributeValues: {
                  ':visibility': 'public',
                  ':username': normalizedUsername
                },
                Limit: 1
              };
              const gsiResult = await dynamodb.query(gsiParams).promise();
              
              if (gsiResult.Items && gsiResult.Items.length > 0) {
                const profile = gsiResult.Items[0];
                recipientEmail = profile.email || profile.userEmail || (profile.PK ? profile.PK.replace('USER#', '') : null);
                if (recipientEmail) {
                  recipientEmail = recipientEmail.toLowerCase();
                  console.log(`   ✅ Found email via GSI (public): ${recipientEmail}`);
                }
              }
            } catch (err) {
              console.error(`⚠️ [comments/post] GSI public lookup error for ${normalizedUsername}: ${err.message}`);
            }
            
            // METHOD 2: Try GSI with private visibility
            if (!recipientEmail) {
              try {
                const gsiParamsPrivate = {
                  TableName: mainTable,
                  IndexName: 'UsernameSearchIndex',
                  KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
                  ExpressionAttributeValues: {
                    ':visibility': 'private',
                    ':username': normalizedUsername
                  },
                  Limit: 1
                };
                const gsiResultPrivate = await dynamodb.query(gsiParamsPrivate).promise();
                if (gsiResultPrivate.Items && gsiResultPrivate.Items.length > 0) {
                  const profile = gsiResultPrivate.Items[0];
                  recipientEmail = profile.email || profile.userEmail || (profile.PK ? profile.PK.replace('USER#', '') : null);
                  if (recipientEmail) {
                    recipientEmail = recipientEmail.toLowerCase();
                    console.log(`   ✅ Found email via GSI (private): ${recipientEmail}`);
                  }
                }
              } catch (err) {
                console.error(`⚠️ [comments/post] GSI private lookup error for ${normalizedUsername}: ${err.message}`);
              }
            }
            
            // METHOD 3: Scan main table if GSI fails (slower but more reliable)
            if (!recipientEmail) {
              try {
                console.log(`   ⚠️ GSI lookup failed, trying table scan for username: ${normalizedUsername}`);
                const scanParams = {
                  TableName: mainTable,
                  FilterExpression: 'username = :username',
                  ExpressionAttributeValues: {
                    ':username': normalizedUsername
                  },
                  Limit: 10 // Limit to prevent huge scans
                };
                const scanResult = await dynamodb.scan(scanParams).promise();
                
                if (scanResult.Items && scanResult.Items.length > 0) {
                  // Find the best match (prefer items with email)
                  const profile = scanResult.Items.find(item => item.email || item.userEmail) || scanResult.Items[0];
                  recipientEmail = profile.email || profile.userEmail || (profile.PK ? profile.PK.replace('USER#', '') : null);
                  if (recipientEmail) {
                    recipientEmail = recipientEmail.toLowerCase();
                    console.log(`   ✅ Found email via table scan: ${recipientEmail}`);
                  }
                }
              } catch (err) {
                console.error(`⚠️ [comments/post] Table scan error for ${normalizedUsername}: ${err.message}`);
              }
            }
            
            // METHOD 4: Use visibleTo as final fallback
            if (!recipientEmail && visibleTo && visibleTo.length > 0) {
              console.log(`   ⚠️ All lookup methods failed, using visibleTo fallback`);
              const senderEmail = userId.toLowerCase();
              for (const email of visibleTo) {
                const normalizedEmail = email.toLowerCase();
                if (normalizedEmail !== senderEmail && normalizedEmail.includes('@')) {
                  recipientEmail = normalizedEmail;
                  console.log(`   ✅ Found recipient email from visibleTo fallback: ${recipientEmail}`);
                  break;
                }
              }
            }
            
            // FINAL CHECK: If still no email, this is a critical error
            if (!recipientEmail) {
              console.error(`❌ [comments/post] CRITICAL: Could not find email for username: ${otherParticipantUsername}`);
              console.error(`   Tried: GSI (public), GSI (private), table scan, visibleTo fallback`);
              console.error(`   visibleTo: [${visibleTo.join(', ')}]`);
            }
            
            if (recipientEmail) {
              // CRITICAL: Only send notification to recipient, NEVER to sender
              const senderEmail = userId.toLowerCase();
              
              if (recipientEmail !== senderEmail) {
                console.log(`   ✅ Found recipient email: ${recipientEmail} (sender: ${senderEmail})`);
                
                // Create notification
                const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const notificationParams = {
                  TableName: mainTable,
                  Item: {
                    PK: `USER#${recipientEmail}`,
                    SK: `NOTIFICATION#${notificationId}`,
                    type: 'private_message',
                    title: 'New Private Message',
                    message: `${senderUsername} sent you a private message`,
                    metadata: {
                      videoId: normalizedVideoId,
                      threadId: parentCommentId || null,
                      senderUsername: senderUsername,
                      senderEmail: senderEmail,
                      recipientEmail: recipientEmail
                    },
                    isRead: false,
                    createdAt: new Date().toISOString()
                  }
                };
                
                await dynamodb.put(notificationParams).promise();
                console.log(`✅ [comments/post] Created notification for ${recipientEmail}: ${senderUsername} sent private message`);
                console.log(`   📦 Notification PK: USER#${recipientEmail}, SK: NOTIFICATION#${notificationId}`);
                
                // CRITICAL: Send WebSocket notification so recipient sees indicator immediately
                try {
                  const { sendWebSocketNotification } = await import('../../utils/websocket-cache.js');
                  const websocketApiEndpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                                              process.env.WSS_ENDPOINT ||
                                              'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';
                  
                  await sendWebSocketNotification(
                    [recipientEmail],
                    'inboxNotification', // Use inboxNotification to trigger checkPrivateMessageNotifications
                    {
                      notificationType: 'private_message',
                      notificationId: notificationId,
                      title: notificationParams.Item.title,
                      message: notificationParams.Item.message,
                      metadata: notificationParams.Item.metadata
                    },
                    websocketApiEndpoint,
                    true // Lambda fallback
                  );
                  console.log(`📡 [comments/post] WebSocket inboxNotification sent to ${recipientEmail}`);
                } catch (wsError) {
                  console.error(`⚠️ [comments/post] Failed to send WebSocket notification: ${wsError.message}`);
                  // Continue - WebSocket is non-blocking
                }
              } else {
                console.log(`⚠️ [comments/post] Skipping notification - recipient is the sender (${recipientEmail})`);
              }
            } else {
              console.error(`❌ [comments/post] Could not find email for username: ${otherParticipantUsername}`);
            }
          } else {
            console.error(`❌ [comments/post] Could not find other participant username in thread`);
            console.error(`   ParentCommentId: ${parentCommentId}`);
            console.error(`   Sender: ${senderUsername}`);
            console.error(`   This means the notification will NOT be sent!`);
          }
        }
      } catch (error) {
        console.error(`❌ [comments/post] Failed to create notification: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
      }
    }

    // Return success response
    return {
      success: true,
      comment: {
        id: commentId,
        videoId: normalizedVideoId, // Return normalized videoId for consistency
        userId: userId,
        username: username,
        text: text.trim(),
        createdAt: timestamp,
        likeCount: 0,
        isLiked: false,
        isPrivate: isPrivate,
        parentCommentId: parentCommentId || null,
        // CRITICAL: NEVER set visibleTo to null for private messages
        visibleTo: isPrivate ? (visibleTo.length > 0 ? visibleTo : []) : (visibleTo.length > 0 ? visibleTo : null),
        mentionedUsername: mentions.length > 0 ? mentions[0] : null
      }
    };
  } catch (error) {
    console.error('❌ [comments/post] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to post comment'
    });
  }
});
