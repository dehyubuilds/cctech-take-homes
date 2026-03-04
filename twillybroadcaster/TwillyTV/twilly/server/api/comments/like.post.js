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

  try {
    const body = await readBody(event);
    const { videoId, commentId, userId, isLiked } = body;

    if (!videoId || !commentId || userId === undefined) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: videoId, commentId, userId'
      });
    }

    console.log(`❤️ [comments/like] ${isLiked ? 'Liking' : 'Unliking'} comment: ${commentId} by user: ${userId}`);

    // Normalize videoId - strip FILE# prefix if present to ensure consistent PK format
    // Normalize videoId - strip FILE# or file- prefix if present
    let normalizedVideoId = videoId;
    if (normalizedVideoId.startsWith('FILE#')) {
      normalizedVideoId = normalizedVideoId.replace('FILE#', '');
    }
    if (normalizedVideoId.startsWith('file-')) {
      normalizedVideoId = normalizedVideoId.replace('file-', '');
    }

    // Find the comment - try multiple methods to find it
    // CRITICAL: Query messaging table with proper PK format
    let comment = null;
    
    // Try both PK formats (with and without file- prefix)
    const pkFormats = [
      `VIDEO#${normalizedVideoId}`,
      `VIDEO#file-${normalizedVideoId}`
    ];
    
    for (const pk of pkFormats) {
      // Method 1: Query by commentId field (most reliable)
      const queryParams = {
        TableName: messagingTable,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'commentId = :commentId',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':skPrefix': 'COMMENT#',
          ':commentId': commentId
        }
      };
      
      let result = await dynamodb.query(queryParams).promise();
      
      if (result.Items && result.Items.length > 0) {
        comment = result.Items[0];
        console.log(`✅ [comments/like] Found comment by commentId: ${commentId} in PK: ${pk}`);
        break;
      }
      
      // Method 2: Query all comments and find by commentId field
      const scanParams = {
        TableName: messagingTable,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':skPrefix': 'COMMENT#'
        }
      };
      
      result = await dynamodb.query(scanParams).promise();
      
      if (result.Items && result.Items.length > 0) {
        // Find comment where commentId matches or SK contains commentId
        comment = result.Items.find(item => {
          const itemCommentId = item.commentId;
          return itemCommentId === commentId || 
                 (itemCommentId && itemCommentId.includes(commentId)) ||
                 (item.SK && item.SK.includes(commentId));
        });
        
        if (comment) {
          console.log(`✅ [comments/like] Found comment by scanning PK: ${pk}`);
          break;
        }
      }
    }

    if (!comment) {
      console.error(`❌ [comments/like] Comment not found: ${commentId} for video: ${normalizedVideoId}`);
      throw createError({
        statusCode: 404,
        statusMessage: 'Comment not found'
      });
    }

    // Update like count and track user likes
    const currentLikeCount = comment.likeCount || 0;
    const likedBy = comment.likedBy || [];

    let newLikeCount = currentLikeCount;
    let newLikedBy = [...likedBy];

    if (isLiked) {
      // Add like if not already liked by this user
      if (!likedBy.includes(userId)) {
        newLikeCount = currentLikeCount + 1;
        newLikedBy.push(userId);
      }
    } else {
      // Remove like if user had liked it
      if (likedBy.includes(userId)) {
        newLikeCount = Math.max(0, currentLikeCount - 1);
        newLikedBy = likedBy.filter(id => id !== userId);
      }
    }

    // Update the comment
    await dynamodb.update({
      TableName: messagingTable,
      Key: {
        PK: comment.PK,
        SK: comment.SK
      },
      UpdateExpression: 'SET likeCount = :likeCount, likedBy = :likedBy',
      ExpressionAttributeValues: {
        ':likeCount': newLikeCount,
        ':likedBy': newLikedBy
      }
    }).promise();

    console.log(`✅ [comments/like] Comment ${isLiked ? 'liked' : 'unliked'} successfully. New count: ${newLikeCount}`);
    
    // PHASE 1-3: Send WebSocket notification via optimized cache service (broadcast to all)
    try {
      const { sendWebSocketNotification } = await import('../../utils/websocket-cache.js');
      const websocketApiEndpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                                  process.env.WSS_ENDPOINT ||
                                  'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';
      
      await sendWebSocketNotification(
        [], // Empty array = broadcast to all connected users
        'comment_liked',
        {
          commentId: commentId,
          videoId: normalizedVideoId,
          likeCount: newLikeCount,
          likedBy: comment.username
        },
        websocketApiEndpoint,
        true // Lambda fallback for broadcast (backward compatibility)
      );
      console.log(`📡 [comments/like] WebSocket notification sent for comment: ${commentId}`);
    } catch (wsError) {
      console.error(`⚠️ [comments/like] Failed to send WebSocket notification: ${wsError.message}`);
      // Continue - WebSocket is non-blocking
    }

    return {
      success: true,
      likeCount: newLikeCount,
      isLiked: newLikedBy.includes(userId)
    };
  } catch (error) {
    console.error('❌ [comments/like] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to update like'
    });
  }
});
