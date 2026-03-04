/**
 * Mock subscribe to a creator (for testing Premium tab without Stripe).
 * Writes SUBSCRIBED_CREATOR# so get-content premium timeline includes that creator's premium posts.
 * Use only in dev/test.
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
    const { subscriberEmail, creatorEmail, creatorUsername } = body;

    if (!subscriberEmail || !creatorEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: subscriberEmail, creatorEmail'
      });
    }

    const subEmail = subscriberEmail.toLowerCase().trim();
    const crEmail = creatorEmail.toLowerCase().trim();
    const now = new Date().toISOString();

    console.log(`👑 [mock-subscribe-creator] Subscribing ${subEmail} -> ${crEmail} (for testing)`);

    // Same shape as Stripe webhook: so get-content premium timeline finds "creators I subscribe to"
    await dynamodb.put({
      TableName: table,
      Item: {
        PK: `USER#${subEmail}`,
        SK: `SUBSCRIBED_CREATOR#${crEmail}`,
        status: 'active',
        creatorEmail: crEmail,
        creatorUsername: creatorUsername || null,
        subscribedAt: now,
        mockSubscription: true
      }
    }).promise();

    // Optional: so get-subscription-status returns isSubscribed: true
    await dynamodb.put({
      TableName: table,
      Item: {
        PK: `USER#${crEmail}`,
        SK: `SUBSCRIPTION#${subEmail}`,
        status: 'active',
        subscriberEmail: subEmail,
        createdAt: now,
        mockSubscription: true
      }
    }).promise();

    return {
      success: true,
      message: 'Mock subscription active. Premium tab will show this creator\'s premium posts.',
      subscriberEmail: subEmail,
      creatorEmail: crEmail
    };
  } catch (error) {
    console.error('❌ [mock-subscribe-creator] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Mock subscribe failed'
    });
  }
});
