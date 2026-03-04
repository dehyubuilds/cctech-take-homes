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
  const messagingTable = process.env.MESSAGING_TABLE || 'TwillyMessaging';

  try {
    const body = await readBody(event);
    const { viewerEmail } = body;

    if (!viewerEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: viewerEmail'
      });
    }

    const normalizedViewerEmail = viewerEmail.toLowerCase();
    console.log(`🔍 [comments/check-all-unreads] Checking all unreads for user: ${normalizedViewerEmail}`);

    // Get all thread views for this user to find which videos they've viewed
    const threadViewParams = {
      TableName: messagingTable,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${normalizedViewerEmail}`,
        ':sk': 'THREAD_VIEW#'
      }
    };
    const threadViewResult = await dynamodb.query(threadViewParams).promise();
    const threadViews = threadViewResult.Items || [];

    // Build map of videoId -> { threadId -> lastViewedAt }
    const videoThreadViews = {};
    for (const view of threadViews) {
      const skParts = view.SK.split('#');
      if (skParts.length >= 3) {
        const videoId = skParts[1];
        const threadId = skParts[2];
        if (!videoThreadViews[videoId]) {
          videoThreadViews[videoId] = {};
        }
        if (view.lastViewedAt) {
          videoThreadViews[videoId][threadId] = new Date(view.lastViewedAt);
        }
      }
    }

    // Get all unique video IDs from thread views
    const videoIds = Object.keys(videoThreadViews);
    console.log(`📋 [comments/check-all-unreads] Found ${videoIds.length} videos with thread views`);

    // Also scan for all VIDEO# entries to find videos with comments (even if user hasn't viewed)
    // This is expensive but necessary to find all videos with potential unreads
    const videoScanParams = {
      TableName: messagingTable,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'VIDEO#'
      },
      Limit: 1000 // Limit to prevent timeout
    };
    const videoScanResult = await dynamodb.scan(videoScanParams).promise();
    const allVideoItems = videoScanResult.Items || [];

    // Extract unique video IDs from scan
    const scannedVideoIds = new Set();
    for (const item of allVideoItems) {
      if (item.PK && item.PK.startsWith('VIDEO#')) {
        const videoId = item.PK.replace('VIDEO#', '');
        scannedVideoIds.add(videoId);
      }
    }

    // Combine both sets of video IDs
    const allVideoIds = new Set([...videoIds, ...Array.from(scannedVideoIds)]);
    console.log(`📋 [comments/check-all-unreads] Checking ${allVideoIds.size} total videos for unreads`);

    // For each video, check for unreads and send indicator if needed
    const unreadVideos = [];
    const { sendWebSocketNotification } = await import('../../utils/websocket-cache.js');
    const websocketApiEndpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                                process.env.WSS_ENDPOINT ||
                                'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';

    for (const videoId of allVideoIds) {
      try {
        // Query comments for this video
        const commentsParams = {
          TableName: messagingTable,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `VIDEO#${videoId}`,
            ':sk': 'COMMENT#'
          },
          Limit: 100 // Limit to prevent timeout
        };
        const commentsResult = await dynamodb.query(commentsParams).promise();
        const comments = commentsResult.Items || [];

        // Get thread views for this video
        const threadLastViewedMap = videoThreadViews[videoId] || {};

        // Check for unread private messages
        let hasUnread = false;
        const unreadThreads = new Set();

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
          if (isPrivate && isParticipant && !isViewerSender) {
            const parentId = comment.parentCommentId || comment.commentId || comment.SK.replace('COMMENT#', '');
            const threadLastViewed = threadLastViewedMap[parentId] || null;

            if (!threadLastViewed || commentDate > threadLastViewed) {
              hasUnread = true;
              unreadThreads.add(parentId);
            }
          }
        }

        // If there are unreads, send indicator notification
        if (hasUnread && unreadThreads.size > 0) {
          // Send indicator for each unread thread
          for (const threadId of unreadThreads) {
            try {
              await sendWebSocketNotification(
                [normalizedViewerEmail],
                'private_message_indicator',
                {
                  videoId: videoId,
                  threadId: threadId,
                  action: 'show',
                  timestamp: new Date().toISOString()
                },
                websocketApiEndpoint,
                true // Lambda fallback
              );
              console.log(`🔔 [comments/check-all-unreads] Sent indicator for video: ${videoId}, thread: ${threadId}`);
            } catch (indicatorError) {
              console.error(`⚠️ [comments/check-all-unreads] Failed to send indicator for ${videoId}/${threadId}: ${indicatorError.message}`);
            }
          }
          unreadVideos.push({ videoId, threadCount: unreadThreads.size });
        }
      } catch (videoError) {
        console.error(`❌ [comments/check-all-unreads] Error checking video ${videoId}: ${videoError.message}`);
      }
    }

    console.log(`✅ [comments/check-all-unreads] Found ${unreadVideos.length} videos with unreads for ${normalizedViewerEmail}`);

    return {
      success: true,
      unreadVideosCount: unreadVideos.length,
      unreadVideos: unreadVideos
    };
  } catch (error) {
    console.error('❌ [comments/check-all-unreads] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to check all unreads'
    });
  }
});
