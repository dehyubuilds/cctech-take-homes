/**
 * Mock "has Twilly TV Premium" for testing (no Stripe).
 * Sets TWILLY_TV_PREMIUM_SUB so get-platform-premium-status returns hasTwillyTVPremium: true.
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
    const now = new Date().toISOString();

    await dynamodb.put({
      TableName: table,
      Item: {
        PK: `USER#${normalized}`,
        SK: 'TWILLY_TV_PREMIUM_SUB',
        status: 'active',
        subscribedAt: now,
        mockSubscription: true
      }
    }).promise();

    return {
      success: true,
      message: 'Twilly TV Premium access enabled (mock). You can add creators to see their premium posts.',
      userEmail: normalized
    };
  } catch (error) {
    console.error('❌ [mock-platform-premium] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Mock platform premium failed'
    });
  }
});
