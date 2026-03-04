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
    const { userEmail, type, title, message, metadata } = body;

    if (!userEmail || !type || !title || !message) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: userEmail, type, title, message'
      });
    }

    console.log(`📬 [create-notification] Creating ${type} notification for ${userEmail}`);

    // Generate unique notification ID
    const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create notification
    const notificationParams = {
      TableName: table,
      Item: {
        PK: `USER#${userEmail}`,
        SK: `NOTIFICATION#${notificationId}`,
        type: type, // 'follow_request', 'follow_accepted', 'follow_declined', 'video_ready', etc.
        title: title,
        message: message,
        metadata: metadata || {},
        isRead: false,
        createdAt: new Date().toISOString()
      }
    };

    await dynamodb.put(notificationParams).promise();

    console.log(`✅ [create-notification] Notification created: ${notificationId}`);

    return {
      success: true,
      message: 'Notification created',
      notificationId: notificationId
    };

  } catch (error) {
    console.error('❌ [create-notification] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to create notification'
    });
  }
});
