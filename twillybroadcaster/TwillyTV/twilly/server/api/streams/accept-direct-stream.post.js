import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';
/** Short clips must never exist; do not copy them into timelines. */
const MIN_DURATION_SECONDS = 6;

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userEmail, notificationId, accept } = body;

    if (!userEmail || !notificationId || typeof accept !== 'boolean') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: userEmail, notificationId, accept (boolean)'
      });
    }

    console.log(`📬 [accept-direct-stream] Processing ${accept ? 'accept' : 'reject'} for notification ${notificationId}`);

    // Get the notification to retrieve video metadata
    const notificationParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail.toLowerCase()}`,
        SK: `NOTIFICATION#${notificationId}`
      }
    };

    const notificationResult = await dynamodb.get(notificationParams).promise();
    
    if (!notificationResult.Item) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Notification not found'
      });
    }

    const notification = notificationResult.Item;
    
    if (notification.type !== 'direct_stream_request') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Notification is not a direct stream request'
      });
    }

    if (notification.status !== 'pending') {
      throw createError({
        statusCode: 400,
        statusMessage: `Notification already ${notification.status}`
      });
    }

    // Update notification status
    const updateParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail.toLowerCase()}`,
        SK: `NOTIFICATION#${notificationId}`
      },
      UpdateExpression: 'SET #status = :status, isRead = :isRead, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': accept ? 'accepted' : 'rejected',
        ':isRead': true,
        ':updatedAt': new Date().toISOString()
      }
    };

    await dynamodb.update(updateParams).promise();

    if (accept) {
      // Create video entry in user's private timeline
      const metadata = notification.metadata || {};
      const fileId = metadata.fileId || notificationId;
      const videoId = metadata.videoId || fileId;
      
      // Get the original video entry to copy
      const originalVideoScanParams = {
        TableName: table,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: {
          ':sk': `FILE#${fileId}`
        },
        Limit: 1
      };
      
      const originalVideoResult = await dynamodb.scan(originalVideoScanParams).promise();
      
      if (originalVideoResult.Items && originalVideoResult.Items.length > 0) {
        const originalVideo = originalVideoResult.Items[0];
        const durationSec = originalVideo.durationSeconds != null ? Number(originalVideo.durationSeconds) : null;
        if (durationSec !== null && durationSec < MIN_DURATION_SECONDS) {
          console.log(`⏱️ [accept-direct-stream] Skipping short clip (${durationSec}s < ${MIN_DURATION_SECONDS}s), not copying to timeline`);
          return {
            success: true,
            message: 'Short video not added to timeline',
            status: 'accepted'
          };
        }
        
        // Create entry in user's private timeline
        const targetVideoItem = {
          ...originalVideo,
          PK: `USER#${userEmail.toLowerCase()}`,
          SK: `FILE#${fileId}`,
          isPrivateUsername: true,
          isDirectStream: true,
          streamerEmail: metadata.streamerEmail || '',
          streamerUsername: metadata.streamerUsername || '',
          acceptedAt: new Date().toISOString()
        };
        
        try {
          await dynamodb.put({
            TableName: 'Twilly',
            Item: targetVideoItem,
            ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)'
          }).promise();
          console.log(`✅ [accept-direct-stream] Created video entry in private timeline for ${userEmail}`);
        } catch (putError) {
          if (putError.code === 'ConditionalCheckFailedException' || putError.name === 'ConditionalCheckFailedException') {
            console.log(`⚠️ [accept-direct-stream] Video entry already exists for ${userEmail}`);
          } else {
            throw putError;
          }
        }
      } else {
        console.error(`⚠️ [accept-direct-stream] Original video not found for fileId: ${fileId}`);
      }
    }

    console.log(`✅ [accept-direct-stream] Notification ${accept ? 'accepted' : 'rejected'}`);

    return {
      success: true,
      message: accept ? 'Direct stream accepted' : 'Direct stream rejected',
      status: accept ? 'accepted' : 'rejected'
    };

  } catch (error) {
    console.error('❌ [accept-direct-stream] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to process direct stream request'
    });
  }
});
