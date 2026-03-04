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
    const { userEmail } = body;

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: userEmail'
      });
    }

    console.log(`🔍 [get-private-username] Getting private username for ${userEmail}`);

    const getParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      }
    };

    const result = await dynamodb.get(getParams).promise();

    if (!result.Item) {
      // Return default (no private username)
      return {
        success: true,
        privateUsername: null,
        hasPrivateUsername: false
      };
    }

    const privateUsername = result.Item.privateUsername || null;

    return {
      success: true,
      privateUsername: privateUsername,
      hasPrivateUsername: !!privateUsername
    };

  } catch (error) {
    console.error('❌ [get-private-username] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to get private username'
    });
  }
});
