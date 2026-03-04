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
    const { userEmail, userId, airDay, airTime } = body;

    if (!userEmail || !userId || !airDay || !airTime) {
      return {
        success: false,
        message: 'Missing required fields: userEmail, userId, airDay, airTime'
      };
    }

    // Check if user already has a locked schedule
    const existingSchedule = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'AIR_SCHEDULE'
      }
    }).promise();

    if (existingSchedule.Item && existingSchedule.Item.isLocked) {
      return {
        success: false,
        message: 'Air schedule is already locked and cannot be changed'
      };
    }

    // Check if this day-time combination is already taken
    const slotKey = `${airDay}-${airTime}`;
    const occupiedSlotsQuery = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'SK = :sk AND airDay = :day AND airTime = :time AND isLocked = :locked',
      ExpressionAttributeValues: {
        ':sk': 'AIR_SCHEDULE',
        ':day': airDay,
        ':time': airTime,
        ':locked': true
      }
    }).promise();

    if (occupiedSlotsQuery.Items && occupiedSlotsQuery.Items.length > 0) {
      return {
        success: false,
        message: 'This day and time slot is already taken. Please select another.'
      };
    }

    // Save the air schedule
    const scheduleItem = {
      PK: `USER#${userEmail}`,
      SK: 'AIR_SCHEDULE',
      userId: userId,
      userEmail: userEmail,
      airDay: airDay,
      airTime: airTime,
      isLocked: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: table,
      Item: scheduleItem
    }).promise();

    console.log(`✅ Air schedule saved for ${userEmail}: ${airDay} at ${airTime}`);

    return {
      success: true,
      message: 'Air schedule saved successfully',
      schedule: {
        airDay,
        airTime,
        isLocked: true
      }
    };

  } catch (error) {
    console.error('Error saving air schedule:', error);
    return {
      success: false,
      message: 'Failed to save air schedule',
      error: error.message
    };
  }
});
