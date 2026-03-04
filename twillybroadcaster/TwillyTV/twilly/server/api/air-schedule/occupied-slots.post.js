import AWS from 'aws-sdk';
import { defineEventHandler } from 'h3';

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
    // Get all locked air schedules
    const result = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'SK = :sk AND isLocked = :locked',
      ExpressionAttributeValues: {
        ':sk': 'AIR_SCHEDULE',
        ':locked': true
      }
    }).promise();

    // Build set of occupied slots (format: "day-time")
    const occupiedSlots = new Set();
    if (result.Items) {
      result.Items.forEach(item => {
        if (item.airDay && item.airTime) {
          occupiedSlots.add(`${item.airDay}-${item.airTime}`);
        }
      });
    }

    return {
      success: true,
      occupiedSlots: Array.from(occupiedSlots)
    };

  } catch (error) {
    console.error('Error getting occupied slots:', error);
    return {
      success: false,
      message: 'Failed to get occupied slots',
      error: error.message,
      occupiedSlots: []
    };
  }
});
