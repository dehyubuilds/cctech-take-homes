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
    const { videoId, viewerEmail, threadId } = body;

    if (!videoId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: videoId'
      });
    }

    if (!viewerEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: viewerEmail'
      });
    }

    if (!threadId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: threadId'
      });
    }

    console.log(`📖 [comments/mark-thread-read] Marking thread as read - video: ${videoId}, thread: ${threadId}, viewer: ${viewerEmail}`);

    // Normalize videoId
    // Normalize videoId - strip FILE# or file- prefix if present
    let normalizedVideoId = videoId;
    if (normalizedVideoId.startsWith('FILE#')) {
      normalizedVideoId = normalizedVideoId.replace('FILE#', '');
    }
    if (normalizedVideoId.startsWith('file-')) {
      normalizedVideoId = normalizedVideoId.replace('file-', '');
    }
    const normalizedViewerEmail = viewerEmail.toLowerCase();

    // Store the last viewed timestamp for this thread
    // Format: PK=USER#viewerEmail, SK=THREAD_VIEW#videoId#threadId
    const viewTimestamp = new Date().toISOString();
    const viewParams = {
      TableName: messagingTable,
      Item: {
        PK: `USER#${normalizedViewerEmail}`,
        SK: `THREAD_VIEW#${normalizedVideoId}#${threadId}`,
        videoId: normalizedVideoId,
        threadId: threadId,
        lastViewedAt: viewTimestamp,
        createdAt: viewTimestamp
      }
    };

    await dynamodb.put(viewParams).promise();

    // CRITICAL: Also mark all comment_reply notifications for this thread as read
    // This ensures the inbox indicator clears immediately
    try {
      // Query for all unread comment_reply notifications for this user
      // Note: We query all and filter in code since DynamoDB doesn't support nested attribute filtering
      const notificationQueryParams = {
        TableName: messagingTable,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'type = :type AND isRead = :isRead',
        ExpressionAttributeValues: {
          ':pk': `USER#${normalizedViewerEmail}`,
          ':skPrefix': 'NOTIFICATION#',
          ':type': 'comment_reply',
          ':isRead': false
        },
        Limit: 100 // Get up to 100 unread comment_reply notifications
      };

      const notificationResult = await dynamodb.query(notificationQueryParams).promise();
      const allUnreadNotifications = notificationResult.Items || [];

      // Filter in code to find notifications matching this thread
      const matchingNotifications = allUnreadNotifications.filter(notification => {
        const metadata = notification.metadata || {};
        const notifVideoId = metadata.videoId || '';
        const notifParentCommentId = metadata.parentCommentId || '';
        // Normalize videoId for comparison (remove FILE# prefix if present)
        const normalizedNotifVideoId = notifVideoId.startsWith('FILE#') 
          ? notifVideoId.replace('FILE#', '') 
          : notifVideoId;
        return normalizedNotifVideoId === normalizedVideoId && notifParentCommentId === threadId;
      });

      if (matchingNotifications.length > 0) {
        console.log(`📬 [comments/mark-thread-read] Found ${matchingNotifications.length} unread comment_reply notifications for thread ${threadId}, marking as read`);

        // Mark each notification as read
        const updatePromises = matchingNotifications.map(notification => {
          return dynamodb.update({
            TableName: messagingTable,
            Key: {
              PK: notification.PK,
              SK: notification.SK
            },
            UpdateExpression: 'SET isRead = :isRead, readAt = :readAt',
            ExpressionAttributeValues: {
              ':isRead': true,
              ':readAt': viewTimestamp
            }
          }).promise();
        });

        await Promise.all(updatePromises);
        console.log(`✅ [comments/mark-thread-read] Marked ${matchingNotifications.length} comment_reply notifications as read`);
      } else {
        console.log(`ℹ️ [comments/mark-thread-read] No unread comment_reply notifications found for thread ${threadId}`);
      }
    } catch (notifError) {
      // Non-blocking - if notification marking fails, still return success for thread marking
      console.error(`⚠️ [comments/mark-thread-read] Failed to mark notifications as read (non-blocking): ${notifError.message}`);
    }

    console.log(`✅ [comments/mark-thread-read] Thread marked as read at ${viewTimestamp}`);

    // WEBSOCKET IS SOURCE OF TRUTH - Send unread_count_update after marking thread as read
    try {
      // Calculate updated unread counts for this viewer
      const commentsParams = {
        TableName: messagingTable,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `VIDEO#${normalizedVideoId}`,
          ':sk': 'COMMENT#'
        },
        ScanIndexForward: false
      };
      const commentsResult = await dynamodb.query(commentsParams).promise();
      const comments = commentsResult.Items || [];
      
      // Check video ownership from comment records (NO SCAN - fast!)
      // videoOwnerEmail is stored in each comment when posted
      // Calculate once before the loop (not inside it!)
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
      
      // Calculate unread counts
      let totalUnread = 0;
      const threadUnreadCounts = {};
      
      for (const comment of comments) {
        const commentDate = new Date(comment.createdAt || comment.timestamp || 0);
        const isPrivate = comment.isPrivate === true;
        const visibleTo = comment.visibleTo || [];
        const isParticipant = visibleTo.includes(normalizedViewerEmail);
        
        // Get commenter email
        let commenterEmail = null;
        if (comment.userId && comment.userId.includes('@')) {
          commenterEmail = comment.userId.toLowerCase();
        }
        const isViewerSender = commenterEmail === normalizedViewerEmail;
        
        // Count unread private messages
        if (isPrivate && (isParticipant || isOwner) && !isViewerSender) {
          const parentId = comment.parentCommentId || comment.commentId || comment.SK.replace('COMMENT#', '');
          // Use updated lastViewedAt from viewTimestamp
          const lastViewedAt = new Date(viewTimestamp);
          if (commentDate > lastViewedAt) {
            totalUnread++;
            if (!threadUnreadCounts[parentId]) {
              threadUnreadCounts[parentId] = 0;
            }
            threadUnreadCounts[parentId]++;
          }
        }
      }
      
      // PHASE 1-3: Send unread_count_update via optimized WebSocket cache service
      const { sendWebSocketNotification } = await import('../../utils/websocket-cache.js');
      const websocketApiEndpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                                  process.env.WSS_ENDPOINT ||
                                  'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';
      
      await sendWebSocketNotification(
        [normalizedViewerEmail],
        'unread_count_update',
        {
          videoId: normalizedVideoId,
          totalUnread: totalUnread,
          threadUnreadCounts: threadUnreadCounts
        },
        websocketApiEndpoint,
        true // Lambda fallback for backward compatibility
      );
      
      console.log(`📊 [comments/mark-thread-read] Sent unread_count_update: ${totalUnread} unread`);
      
      // FASTEST APPROACH: Send simple "clear" indicator if all unreads are cleared
      if (totalUnread === 0) {
        try {
          await sendWebSocketNotification(
            [normalizedViewerEmail],
            'private_message_indicator',
            {
              videoId: normalizedVideoId,
              threadId: threadId,
              action: 'clear',
              timestamp: new Date().toISOString()
            },
            websocketApiEndpoint,
            true // Lambda fallback
          );
          
          console.log(`🔔 [comments/mark-thread-read] ✅ Sent private_message_indicator (clear) - all unreads cleared`);
        } catch (indicatorError) {
          console.error(`⚠️ [comments/mark-thread-read] Failed to send clear indicator: ${indicatorError.message}`);
        }
      }
    } catch (wsError) {
      console.error(`⚠️ [comments/mark-thread-read] Failed to send unread_count_update: ${wsError.message}`);
      // Continue - WebSocket is non-blocking
    }

    return {
      success: true,
      lastViewedAt: viewTimestamp
    };
  } catch (error) {
    console.error('❌ [comments/mark-thread-read] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to mark thread as read'
    });
  }
});
