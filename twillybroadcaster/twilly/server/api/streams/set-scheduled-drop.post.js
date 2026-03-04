import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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',
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { streamKey, scheduledDropDate } = body;

    if (!streamKey) {
      return {
        success: false,
        message: 'Missing required field: streamKey'
      };
    }

    console.log('📅 [set-scheduled-drop] Setting scheduled drop date:', {
      streamKey,
      scheduledDropDate
    });

    // Update streamKey mapping with scheduled drop date
    try {
      // Get existing streamKey mapping
      const getParams = {
        TableName: table,
        Key: {
          PK: `STREAM_KEY#${streamKey}`,
          SK: 'MAPPING'
        }
      };

      const existing = await dynamodb.get(getParams).promise();

      if (existing.Item) {
        // Update existing mapping
        const updateParams = {
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${streamKey}`,
            SK: 'MAPPING'
          },
          UpdateExpression: scheduledDropDate
            ? 'SET scheduledDropDate = :date, postImmediately = :immediate'
            : 'REMOVE scheduledDropDate SET postImmediately = :immediate',
          ExpressionAttributeValues: scheduledDropDate
            ? {
                ':date': scheduledDropDate,
                ':immediate': false
              }
            : {
                ':immediate': true
              }
        };

        await dynamodb.update(updateParams).promise();
        console.log('✅ [set-scheduled-drop] Updated streamKey mapping with scheduled drop date');
      } else {
        console.log('⚠️ [set-scheduled-drop] StreamKey mapping not found, creating new entry');
        // Create new mapping entry
        const putParams = {
          TableName: table,
          Item: {
            PK: `STREAM_KEY#${streamKey}`,
            SK: 'MAPPING',
            streamKey: streamKey,
            postImmediately: !scheduledDropDate,
            ...(scheduledDropDate && { scheduledDropDate: scheduledDropDate })
          }
        };
        await dynamodb.put(putParams).promise();
        console.log('✅ [set-scheduled-drop] Created new streamKey mapping with scheduled drop date');
      }

      return {
        success: true,
        message: scheduledDropDate ? 'Scheduled drop date set' : 'Post immediately enabled'
      };
    } catch (error) {
      console.error('❌ [set-scheduled-drop] Error updating streamKey mapping:', error);
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to set scheduled drop date'
      });
    }
  } catch (error) {
    console.error('❌ [set-scheduled-drop] Error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to set scheduled drop date'
    });
  }
});
