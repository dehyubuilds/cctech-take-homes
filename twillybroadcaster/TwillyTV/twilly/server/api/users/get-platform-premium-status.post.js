/**
 * Check if the user has an active Twilly TV Premium platform subscription ($3.99).
 * Used to gate Premium tab and "add creators to premium feed" flow.
 */
import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
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

    const normalized = userEmail.toLowerCase().trim();

    const result = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${normalized}`,
        SK: 'TWILLY_TV_PREMIUM_SUB'
      }
    }).promise();

    const item = result.Item;
    const active = item && (item.status === 'active' || item.status === 'trialing');
    const expiresAt = item?.expiresAt || null;

    return {
      success: true,
      hasTwillyTVPremium: !!active,
      status: item?.status || 'none',
      expiresAt
    };
  } catch (error) {
    console.error('❌ [get-platform-premium-status] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to get platform premium status'
    });
  }
});
