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
    const { userEmail, notificationId } = body;

    if (!userEmail || !notificationId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: userEmail and notificationId'
      });
    }

    console.log(`✅ [mark-notification-read] Marking notification ${notificationId} as read for ${userEmail}`);

    // Update notification to mark as read
    const updateParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: `NOTIFICATION#${notificationId}`
      },
      UpdateExpression: 'SET isRead = :isRead, readAt = :readAt',
      ExpressionAttributeValues: {
        ':isRead': true,
        ':readAt': new Date().toISOString()
      }
    };

    await dynamodb.update(updateParams).promise();

    console.log(`✅ [mark-notification-read] Notification marked as read`);

    return {
      success: true,
      message: 'Notification marked as read'
    };

  } catch (error) {
    console.error('❌ [mark-notification-read] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to mark notification as read'
    });
  }
});
