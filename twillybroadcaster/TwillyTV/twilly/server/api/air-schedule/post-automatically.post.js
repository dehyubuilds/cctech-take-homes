import { defineEventHandler, readBody } from 'h3';
import AWS from 'aws-sdk';

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
    const { userEmail, userId, postAutomatically } = body;

    if (!userEmail || postAutomatically === undefined) {
      return {
        success: false,
        message: 'Missing required fields: userEmail and postAutomatically'
      };
    }

    console.log(`🔧 [post-automatically] Setting postAutomatically=${postAutomatically} for user: ${userEmail}`);

    // Save postAutomatically setting
    const item = {
      PK: `USER#${userEmail}`,
      SK: 'POST_AUTOMATICALLY',
      postAutomatically: postAutomatically,
      updatedAt: new Date().toISOString()
    };

    if (userId) {
      item.userId = userId;
    }

    await dynamodb.put({
      TableName: table,
      Item: item
    }).promise();

    // If postAutomatically is enabled, pause the recurring schedule
    if (postAutomatically === true) {
      console.log(`🔧 [post-automatically] Pausing recurring schedule for user: ${userEmail}`);
      
      // Get current schedule
      const scheduleResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'AIR_SCHEDULE'
        }
      }).promise();

      if (scheduleResult.Item && scheduleResult.Item.isLocked) {
        // Pause the schedule (don't delete it, just flag it as paused)
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `USER#${userEmail}`,
            SK: 'AIR_SCHEDULE'
          },
          UpdateExpression: 'SET isPaused = :isPaused, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':isPaused': true,
            ':updatedAt': new Date().toISOString()
          }
        }).promise();

        console.log(`✅ [post-automatically] Recurring schedule paused`);
      }
    } else {
      // If postAutomatically is disabled, resume the schedule if it was paused
      console.log(`🔧 [post-automatically] Checking if schedule should be resumed for user: ${userEmail}`);
      
      const scheduleResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'AIR_SCHEDULE'
        }
      }).promise();

      if (scheduleResult.Item && scheduleResult.Item.isPaused) {
        // Resume the schedule
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `USER#${userEmail}`,
            SK: 'AIR_SCHEDULE'
          },
          UpdateExpression: 'SET isPaused = :isPaused, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':isPaused': false,
            ':updatedAt': new Date().toISOString()
          }
        }).promise();

        console.log(`✅ [post-automatically] Recurring schedule resumed`);
      }
    }

    return {
      success: true,
      message: `Post automatically ${postAutomatically ? 'enabled' : 'disabled'}`
    };
  } catch (error) {
    console.error('Error setting post automatically:', error);
    return {
      success: false,
      message: error.message
    };
  }
});
