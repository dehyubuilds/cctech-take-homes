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
    const { userEmail, notificationSK } = body;

    if (!userEmail || !notificationSK) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: userEmail and notificationSK'
      });
    }

    console.log(`🗑️ [delete-notification] Deleting notification ${notificationSK} for ${userEmail}`);

    // Delete notification
    const deleteParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail.toLowerCase()}`,
        SK: notificationSK
      }
    };

    await dynamodb.delete(deleteParams).promise();

    console.log(`✅ [delete-notification] Notification deleted`);

    return {
      success: true,
      message: 'Notification deleted'
    };

  } catch (error) {
    console.error('❌ [delete-notification] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to delete notification'
    });
  }
});
