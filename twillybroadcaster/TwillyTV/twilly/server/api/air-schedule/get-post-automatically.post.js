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
    const { userEmail } = body;

    if (!userEmail) {
      return {
        success: false,
        postAutomatically: false
      };
    }

    const result = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'POST_AUTOMATICALLY'
      }
    }).promise();

    if (result.Item) {
      return {
        success: true,
        postAutomatically: result.Item.postAutomatically === true
      };
    }

    // Default to false if not set
    return {
      success: true,
      postAutomatically: false
    };
  } catch (error) {
    console.error('Error getting post automatically setting:', error);
    return {
      success: false,
      postAutomatically: false
    };
  }
});
