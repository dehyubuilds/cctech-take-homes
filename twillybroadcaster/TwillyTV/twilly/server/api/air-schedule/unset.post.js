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
    const { userEmail, pause } = body; // pause: true to pause, false to resume

    if (!userEmail || pause === undefined) {
      return {
        success: false,
        message: 'Missing required fields: userEmail and pause'
      };
    }

    console.log(`🔧 [pause-schedule] ${pause ? 'Pausing' : 'Resuming'} schedule for user: ${userEmail}`);

    // Get current schedule
    const scheduleResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'AIR_SCHEDULE'
      }
    }).promise();

    if (!scheduleResult.Item) {
      return {
        success: false,
        message: 'No schedule found'
      };
    }

    // Pause or resume the schedule
    await dynamodb.update({
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'AIR_SCHEDULE'
      },
      UpdateExpression: 'SET isPaused = :isPaused, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isPaused': pause,
        ':updatedAt': new Date().toISOString()
      }
    }).promise();

    console.log(`✅ [pause-schedule] Schedule ${pause ? 'paused' : 'resumed'} successfully`);

    return {
      success: true,
      message: `Schedule ${pause ? 'paused' : 'resumed'} successfully`
    };
  } catch (error) {
    console.error('Error pausing/resuming schedule:', error);
    return {
      success: false,
      message: error.message
    };
  }
});
