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
    const { videoIds, viewerEmail, lastViewedTimestamps } = body;

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: videoIds (array)'
      });
    }

    if (!viewerEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: viewerEmail'
      });
    }

    // lastViewedTimestamps is optional - if not provided, all comments are considered unread
    const lastViewedMap = lastViewedTimestamps || {};

    console.log(`🔍 [comments/unread-count] Fetching unread comment counts for ${videoIds.length} videos (viewer: ${viewerEmail})`);

    const unreadCounts = {};
    
    // Process in batches to avoid overwhelming DynamoDB
    const batchSize = 10;
    for (let i = 0; i < videoIds.length; i += batchSize) {
      const batch = videoIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (videoId) => {
        try {
          // Normalize videoId - strip FILE# prefix if present
          // Normalize videoId - strip FILE# or file- prefix if present
          let normalizedVideoId = videoId;
          if (normalizedVideoId.startsWith('FILE#')) {
            normalizedVideoId = normalizedVideoId.replace('FILE#', '');
          }
          if (normalizedVideoId.startsWith('file-')) {
            normalizedVideoId = normalizedVideoId.replace('file-', '');
          }
          
          // Query comments for this video
          const params = {
            TableName: messagingTable,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `VIDEO#${normalizedVideoId}`,
              ':sk': 'COMMENT#'
            },
            ConsistentRead: true
          };

          const result = await dynamodb.query(params).promise();
          const comments = result.Items || [];
          
          const normalizedViewerEmail = viewerEmail.toLowerCase();
          
          // Check video ownership from comment records (NO SCAN - fast!)
          // videoOwnerEmail is stored in each comment when posted
          let isOwner = false;
          if (comments.length > 0) {
            const commentWithOwner = comments.find(c => 
              c.videoOwnerEmail && 
              c.videoOwnerEmail.toLowerCase() === normalizedViewerEmail
            );
            if (commentWithOwner) {
              isOwner = true;
            }
          }
          
          // CRITICAL FIX: Fallback to check video ownership from video entry if videoOwnerEmail is missing
          // This handles cases where videoOwnerEmail wasn't stored correctly when posting
          if (!isOwner && normalizedViewerEmail) {
            try {
              const fileId = normalizedVideoId.startsWith('FILE#') ? normalizedVideoId.replace('FILE#', '') : normalizedVideoId;
              const searchSK = `FILE#${fileId}`;
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
                  const ownerEmail = ownerPK.replace('USER#', '').toLowerCase();
                  if (ownerEmail === normalizedViewerEmail) {
                    isOwner = true;
                    console.log(`✅ [comments/unread-count] Fallback: Confirmed video owner from video entry: ${normalizedViewerEmail}`);
                  }
                }
              }
            } catch (err) {
              console.error(`⚠️ [comments/unread-count] Error in fallback video owner check: ${err.message}`);
            }
          }
          
          // Query thread view timestamps from DynamoDB
          const threadViewParams = {
            TableName: messagingTable,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
              ':pk': `USER#${normalizedViewerEmail}`,
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
          
          // Get last viewed timestamp for this video (for public comments)
          const lastViewedAt = lastViewedMap[videoId] ? new Date(lastViewedMap[videoId]) : null;
          
          // OPTIMIZATION: Pre-build maps to avoid N+1 queries and nested loops
          // Build map of userId -> email (cache profile lookups)
          const userIdToEmailMap = new Map();
          // Build map of threadId -> participants (for fast thread participant checks)
          const threadParticipantsMap = new Map(); // threadId -> Set of participant emails
          
          // First pass: Build thread participants map and cache user emails
          for (const comment of comments) {
            const parentId = comment.parentCommentId || comment.commentId || comment.SK.replace('COMMENT#', '');
            const visibleTo = comment.visibleTo || [];
            
            // Add visibleTo participants to thread map
            if (!threadParticipantsMap.has(parentId)) {
              threadParticipantsMap.set(parentId, new Set());
            }
            visibleTo.forEach(email => {
              if (email && typeof email === 'string' && email.includes('@')) {
                threadParticipantsMap.get(parentId).add(email.toLowerCase());
              }
            });
            
            // Cache commenter email if userId is an email
            const commentUserId = comment.userId;
            if (commentUserId && commentUserId.includes('@')) {
              userIdToEmailMap.set(commentUserId, commentUserId.toLowerCase());
              // Also add to thread participants (commenter is always a participant)
              threadParticipantsMap.get(parentId).add(commentUserId.toLowerCase());
            }
            
            // CRITICAL: If visibleTo is empty but this is a private message, try to infer participants
            // This is a safety net in case visibleTo wasn't populated correctly
            if (comment.isPrivate === true && (!visibleTo || visibleTo.length === 0) && commentUserId && commentUserId.includes('@')) {
              // For private messages, at minimum the commenter is a participant
              // The recipient should be in visibleTo, but if it's empty, we can't determine it here
              // This is logged as a warning
              console.log(`⚠️ [comments/unread-count] Private message with empty visibleTo: commentId=${comment.commentId}, commenter=${commentUserId}`);
            }
          }
          
          // OPTIMIZATION: Batch fetch missing user profiles (only for userIds that aren't emails)
          const userIdsToFetch = new Set();
          for (const comment of comments) {
            const commentUserId = comment.userId;
            if (commentUserId && !commentUserId.includes('@') && !userIdToEmailMap.has(commentUserId)) {
              userIdsToFetch.add(commentUserId);
            }
          }
          
          // Batch fetch profiles (limit to 25 at a time - DynamoDB batch limit)
          if (userIdsToFetch.size > 0) {
            const userIdsArray = Array.from(userIdsToFetch);
            const batchSize = 25;
            for (let i = 0; i < userIdsArray.length; i += batchSize) {
              const batch = userIdsArray.slice(i, i + batchSize);
              const batchGetParams = {
                RequestItems: {
                  [messagingTable]: {
                    Keys: batch.map(userId => ({
                      PK: `USER#${userId}`,
                      SK: 'PROFILE'
                    }))
                  }
                }
              };
              
              try {
                const batchResult = await dynamodb.batchGet(batchGetParams).promise();
                if (batchResult.Responses && batchResult.Responses[messagingTable]) {
                  for (const item of batchResult.Responses[messagingTable]) {
                    const userId = item.PK.replace('USER#', '');
                    const email = (item.email || item.userEmail || userId).toLowerCase();
                    userIdToEmailMap.set(userId, email);
                    
                    // Add to thread participants for all threads this user participated in
                    for (const comment of comments) {
                      if (comment.userId === userId) {
                        const parentId = comment.parentCommentId || comment.commentId || comment.SK.replace('COMMENT#', '');
                        if (!threadParticipantsMap.has(parentId)) {
                          threadParticipantsMap.set(parentId, new Set());
                        }
                        threadParticipantsMap.get(parentId).add(email);
                      }
                    }
                  }
                }
              } catch (err) {
                console.error(`⚠️ [comments/unread-count] Error batch fetching profiles: ${err.message}`);
              }
            }
          }
          
          // Filter comments: count unread private thread messages where viewer is a participant
          // IMPORTANT: Only counts actual text comment messages, NOT likes/hearts
          let unreadCount = 0;
          const threadUnreadCounts = {}; // threadId -> count
          
          for (const comment of comments) {
            const commentDate = new Date(comment.createdAt || comment.timestamp || 0);
            const isPrivate = comment.isPrivate === true;
            const hasParent = comment.parentCommentId != null;
            const visibleTo = comment.visibleTo || [];
            const isParticipant = normalizedViewerEmail && visibleTo.some(email => email.toLowerCase() === normalizedViewerEmail);
            
            // Get commenter email from cache (fast lookup)
            const commentUserId = comment.userId;
            const commenterEmail = userIdToEmailMap.get(commentUserId) || (commentUserId && commentUserId.includes('@') ? commentUserId.toLowerCase() : null);
            const isViewerSender = commenterEmail === normalizedViewerEmail;
            
            // OPTIMIZATION: Check thread participation using pre-built map (O(1) lookup instead of O(n))
            const parentId = comment.parentCommentId || comment.commentId || comment.SK.replace('COMMENT#', '');
            const threadParticipants = threadParticipantsMap.get(parentId) || new Set();
            const isThreadParticipant = threadParticipants.has(normalizedViewerEmail);
            
            // CRITICAL FIX: Also check if viewer is the parent commenter (the person who started the thread)
            // This handles cases where visibleTo might not be populated correctly
            // Find the parent comment to get the original commenter's email
            let isParentCommenter = false;
            if (comment.parentCommentId) {
              // Look for the parent comment in the comments array
              const parentComment = comments.find(c => c.commentId === comment.parentCommentId);
              if (parentComment) {
                const parentCommenterEmail = userIdToEmailMap.get(parentComment.userId) || 
                                            (parentComment.userId && parentComment.userId.includes('@') ? parentComment.userId.toLowerCase() : null);
                isParentCommenter = parentCommenterEmail === normalizedViewerEmail;
              }
            }
            
            // Count private thread messages where:
            // 1. Comment is EXPLICITLY marked as private (isPrivate === true) - NOT just any reply
            // 2. Viewer is a participant (in visibleTo array of THIS message) OR viewer is the video owner OR viewer is a thread participant OR viewer is the parent commenter
            // 3. Comment was created after the thread was last viewed (or never viewed)
            // 4. CRITICAL: Don't count messages sent by the viewer (only count received messages)
            // 5. CRITICAL: Only count if viewer is explicitly in visibleTo of THIS message OR is a thread participant OR is the parent commenter
            //    This ensures we only count messages that were actually sent TO the viewer
            // NOTE: hasParent alone doesn't mean private - general chat replies also have parentCommentId
            //       So we ONLY count if isPrivate === true (explicitly marked as private)
            const isExplicitRecipient = isParticipant || isThreadParticipant || isParentCommenter; // Check if viewer is in visibleTo OR is a thread participant OR started the thread
            
            // CRITICAL FIX: Also check if this specific comment's videoOwnerEmail matches viewer
            // This handles cases where videoOwnerEmail is stored per-comment but isOwner wasn't set from other comments
            const commentVideoOwnerEmail = comment.videoOwnerEmail ? comment.videoOwnerEmail.toLowerCase() : null;
            const isCommentOwner = commentVideoOwnerEmail === normalizedViewerEmail;
            const isViewerOwner = isOwner || isCommentOwner; // Use either global isOwner or comment-specific isCommentOwner
            
            // CRITICAL DEBUG: Log why message is/isn't being counted
            if (isPrivate && !isViewerSender) {
              console.log(`🔍 [comments/unread-count] Checking message: threadId=${parentId}, commenter=${commenterEmail}, viewer=${normalizedViewerEmail}`);
              console.log(`   isParticipant: ${isParticipant}, isThreadParticipant: ${isThreadParticipant}, isParentCommenter: ${isParentCommenter}`);
              console.log(`   isExplicitRecipient: ${isExplicitRecipient}, isOwner: ${isOwner}, isCommentOwner: ${isCommentOwner}, isViewerOwner: ${isViewerOwner}`);
              console.log(`   visibleTo: [${visibleTo.join(', ')}]`);
              console.log(`   comment.videoOwnerEmail: ${commentVideoOwnerEmail}`);
            }
            
            // Count unread messages
            // CRITICAL: Use isViewerOwner (checks both global isOwner and comment-specific isCommentOwner)
            if (isPrivate && (isExplicitRecipient || isViewerOwner) && !isViewerSender) {
              const threadLastViewed = threadLastViewedMap[parentId] ? new Date(threadLastViewedMap[parentId]) : lastViewedAt;
              const isUnread = !threadLastViewed || commentDate > threadLastViewed;
              
              // COMPREHENSIVE LOGGING: Log all unread message details
              if (isUnread) {
                console.log(`\n🔔 [comments/unread-count] ========== FOUND UNREAD MESSAGE ==========`);
                console.log(`   threadId: ${parentId}`);
                console.log(`   commenterEmail: ${commenterEmail}`);
                console.log(`   viewerEmail: ${normalizedViewerEmail}`);
                console.log(`   isExplicitRecipient: ${isExplicitRecipient}`);
                console.log(`   isOwner: ${isOwner}, isCommentOwner: ${isCommentOwner}, isViewerOwner: ${isViewerOwner}`);
                console.log(`   isParentCommenter: ${isParentCommenter}`);
                console.log(`   isThreadParticipant: ${isThreadParticipant}`);
                console.log(`   isViewerSender: ${isViewerSender}`);
                console.log(`   visibleTo: [${visibleTo.join(', ')}]`);
                console.log(`   comment.videoOwnerEmail: ${commentVideoOwnerEmail}`);
                console.log(`   threadLastViewed: ${threadLastViewed ? threadLastViewed.toISOString() : 'never'}`);
                console.log(`   commentDate: ${commentDate.toISOString()}`);
                console.log(`================================================\n`);
              }
              
              if (isUnread) {
                unreadCount++;
                // Track per-thread counts
                if (!threadUnreadCounts[parentId]) {
                  threadUnreadCounts[parentId] = 0;
                }
                threadUnreadCounts[parentId]++;
                console.log(`✅ [comments/unread-count] Incremented unread count: total=${unreadCount}, thread=${parentId} count=${threadUnreadCounts[parentId]}`);
              }
            } else if (isPrivate && !isViewerSender) {
              // COMPREHENSIVE LOGGING: Why wasn't this message counted?
              console.log(`\n⚠️ [comments/unread-count] ========== PRIVATE MESSAGE NOT COUNTED ==========`);
              console.log(`   threadId: ${parentId}`);
              console.log(`   commenterEmail: ${commenterEmail}`);
              console.log(`   viewerEmail: ${normalizedViewerEmail}`);
              console.log(`   isExplicitRecipient: ${isExplicitRecipient}`);
              console.log(`   isOwner: ${isOwner}, isCommentOwner: ${isCommentOwner}, isViewerOwner: ${isViewerOwner}`);
              console.log(`   isParentCommenter: ${isParentCommenter}`);
              console.log(`   isThreadParticipant: ${isThreadParticipant}`);
              console.log(`   isViewerSender: ${isViewerSender}`);
              console.log(`   visibleTo: [${visibleTo.join(', ')}]`);
              console.log(`   comment.videoOwnerEmail: ${commentVideoOwnerEmail}`);
              console.log(`   REASON: ${!isExplicitRecipient && !isViewerOwner ? 'Not explicit recipient AND not owner' : isViewerSender ? 'Viewer is sender' : 'Unknown'}`);
              console.log(`================================================\n`);
            }
            // Also count public comments if viewer is owner and they haven't viewed them
            else if (!isPrivate && !hasParent && isOwner && lastViewedAt && commentDate > lastViewedAt) {
              unreadCount++;
            }
          }
          
          // CRITICAL FIX: Use normalized videoId as key in response (frontend normalizes when looking up)
          // This ensures the frontend can find the response even if it sent videoId with FILE# prefix
          unreadCounts[normalizedVideoId] = {
            total: unreadCount,
            threads: threadUnreadCounts
          };
          
          console.log(`\n📊 [comments/unread-count] ========== UNREAD COUNT RESULT ==========`);
          console.log(`   original videoId: ${videoId}`);
          console.log(`   normalized videoId (used as key): ${normalizedVideoId}`);
          console.log(`   viewerEmail: ${viewerEmail}`);
          console.log(`   isOwner: ${isOwner}`);
          console.log(`   totalUnread: ${unreadCount}`);
          console.log(`   threadUnreadCounts: ${JSON.stringify(threadUnreadCounts)}`);
          console.log(`   thread IDs returned: ${Object.keys(threadUnreadCounts).join(', ')}`);
          console.log(`   lastViewedAt: ${lastViewedAt ? lastViewedAt.toISOString() : 'never'}`);
          console.log(`================================================\n`);
        } catch (error) {
          console.error(`❌ [comments/unread-count] Error counting unread comments for ${videoId}: ${error.message}`);
          // CRITICAL: Use normalized videoId for consistency (same as success case)
          let normalizedVideoIdForError = videoId;
          if (normalizedVideoIdForError.startsWith('FILE#')) {
            normalizedVideoIdForError = normalizedVideoIdForError.replace('FILE#', '');
          }
          if (normalizedVideoIdForError.startsWith('file-')) {
            normalizedVideoIdForError = normalizedVideoIdForError.replace('file-', '');
          }
          unreadCounts[normalizedVideoIdForError] = { total: 0, threads: {} }; // Default to 0 on error
        }
      }));
    }

    return {
      success: true,
      unreadCounts: unreadCounts
    };
  } catch (error) {
    console.error('❌ [comments/unread-count] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to fetch unread comment counts'
    });
  }
});
