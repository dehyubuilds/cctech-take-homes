import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

/**
 * Clear all ADDED_USERNAME entries for a user (Twilly TV "start fresh").
 * Deletes both public and private added usernames for the given userEmail.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    let { userEmail } = body;

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: userEmail'
      });
    }

    userEmail = userEmail.toLowerCase();
    console.log(`🧹 [clear-added-usernames] Clearing all added usernames for ${userEmail}`);

    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userEmail}`,
        ':skPrefix': 'ADDED_USERNAME#'
      }
    };

    const result = await dynamodb.query(queryParams).promise();
    const items = result.Items || [];
    console.log(`🧹 [clear-added-usernames] Found ${items.length} ADDED_USERNAME entries to delete`);

    let deletedCount = 0;
    for (const item of items) {
      try {
        await dynamodb.delete({
          TableName: table,
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }).promise();
        const creator = (item.streamerEmail || '').toLowerCase();
        if (creator) {
          await dynamodb.delete({
            TableName: table,
            Key: {
              PK: `STREAMER_FOLLOWERS#${creator}`,
              SK: `VIEWER#${userEmail}`
            }
          }).promise().catch(() => {});
        }
        deletedCount++;
      } catch (err) {
        console.error(`❌ [clear-added-usernames] Error deleting ${item.SK}:`, err.message);
      }
    }

    console.log(`✅ [clear-added-usernames] Deleted ${deletedCount} entries for ${userEmail}`);

    return {
      success: true,
      message: 'All added usernames cleared',
      deletedCount
    };
  } catch (error) {
    console.error('❌ [clear-added-usernames] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to clear added usernames'
    });
  }
});
