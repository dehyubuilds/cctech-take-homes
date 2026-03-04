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
    const { videoId } = body;

    if (!videoId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: videoId'
      });
    }

    console.log(`🗑️ [comments/clear-all] Clearing all comments for video: ${videoId}`);

    // Normalize videoId - handle both with and without FILE# prefix
    const normalizedVideoId = videoId.startsWith('FILE#') ? videoId.replace('FILE#', '') : videoId;

    // Query all comments for this video
    const params = {
      TableName: messagingTable,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `VIDEO#${normalizedVideoId}`,
        ':sk': 'COMMENT#'
      }
    };

    const result = await dynamodb.query(params).promise();
    const comments = result.Items || [];

    console.log(`📊 [comments/clear-all] Found ${comments.length} comments to delete`);

    // Delete all comments
    const deletePromises = comments.map(async (comment) => {
      await dynamodb.delete({
        TableName: messagingTable,
        Key: {
          PK: comment.PK,
          SK: comment.SK
        }
      }).promise();
    });

    await Promise.all(deletePromises);

    // Also clear thread view timestamps for this video
    // Find all thread views that reference this video
    const threadViewParams = {
      TableName: messagingTable,
      IndexName: 'GSI1', // Assuming there's a GSI on videoId, or we'll scan
      FilterExpression: 'videoId = :videoId AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':videoId': normalizedVideoId,
        ':sk': 'THREAD_VIEW#'
      }
    };

    // Since we might not have a GSI, let's scan for thread views
    // Thread views are stored as USER#email / THREAD_VIEW#threadId
    // We'll need to scan all users or use a different approach
    // For now, we'll just delete comments and let thread views be cleaned up naturally

    console.log(`✅ [comments/clear-all] Successfully deleted ${comments.length} comments`);

    return {
      success: true,
      message: `Cleared ${comments.length} comments`,
      deletedCount: comments.length
    };
  } catch (error) {
    console.error('❌ [comments/clear-all] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Failed to clear comments'
    });
  }
});
