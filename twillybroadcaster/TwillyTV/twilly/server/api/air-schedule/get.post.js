import AWS from 'aws-sdk';
import { defineEventHandler, readBody } from 'h3';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials for deployment compatibility
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const table = 'Twilly';

  try {
    const body = await readBody(event);
    const { userEmail } = body;

    if (!userEmail) {
      return {
        success: false,
        message: 'Missing required field: userEmail'
      };
    }

    // Get user's air schedule
    const result = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'AIR_SCHEDULE'
      }
    }).promise();

    if (result.Item) {
      return {
        success: true,
        schedule: {
          airDay: result.Item.airDay,
          airTime: result.Item.airTime,
          isLocked: result.Item.isLocked || false,
          isPaused: result.Item.isPaused || false
        }
      };
    } else {
      return {
        success: true,
        schedule: null
      };
    }

  } catch (error) {
    console.error('Error getting air schedule:', error);
    return {
      success: false,
      message: 'Failed to get air schedule',
      error: error.message
    };
  }
});
