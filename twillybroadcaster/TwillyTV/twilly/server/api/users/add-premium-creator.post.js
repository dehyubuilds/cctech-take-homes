/**
 * Add a creator to the viewer's premium feed (Twilly TV Premium).
 * Caller must have platform subscription (Twilly TV Premium). Writes SUBSCRIBED_CREATOR#
 * so get-content includes that creator's premium posts in the viewer's premium tab.
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

    // Optional: enforce platform sub (has Twilly TV Premium)
    const platformSub = await dynamodb.get({
      TableName: table,
      Key: { PK: `USER#${subEmail}`, SK: 'TWILLY_TV_PREMIUM_SUB' }
    }).promise();
    const hasPlatformPremium = platformSub.Item && (platformSub.Item.status === 'active' || platformSub.Item.status === 'trialing');
    if (!hasPlatformPremium) {
      return {
        success: false,
        message: 'Subscribe to Twilly TV Premium first to add creators to your premium feed.',
        requiresPlatformPremium: true
      };
    }

    await dynamodb.put({
      TableName: table,
      Item: {
        PK: `USER#${subEmail}`,
        SK: `SUBSCRIBED_CREATOR#${crEmail}`,
        status: 'active',
        creatorEmail: crEmail,
        creatorUsername: creatorUsername || null,
        addedAt: now
      }
    }).promise();

    await dynamodb.put({
      TableName: table,
      Item: {
        PK: `USER#${crEmail}`,
        SK: `SUBSCRIPTION#${subEmail}`,
        status: 'active',
        subscriberEmail: subEmail,
        createdAt: now
      }
    }).promise();

    return {
      success: true,
      message: 'Creator added to your premium feed. Their premium posts will appear in the Premium tab.',
      subscriberEmail: subEmail,
      creatorEmail: crEmail
    };
  } catch (error) {
    console.error('❌ [add-premium-creator] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Add premium creator failed'
    });
  }
});
