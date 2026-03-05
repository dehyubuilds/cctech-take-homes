/**
 * Add a premium-enabled creator to the viewer's premium feed (Twilly TV).
 * Premium works like public: ADDED_USERNAME#creatorEmail#premium + STREAMER_FOLLOWERS with streamerVisibility='premium'.
 * No subscription/payment; request body uses subscriberEmail for backward compatibility (treated as viewerEmail).
 */
import AWS from 'aws-sdk';
import { defineEventHandler, readBody } from 'h3';

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
      return {
        success: false,
        message: 'Missing required fields: subscriberEmail, creatorEmail'
      };
    }

    const vEmail = (subscriberEmail || '').toLowerCase().trim();
    const cEmail = (creatorEmail || '').toLowerCase().trim();
    const now = new Date().toISOString();

    const existing = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${vEmail}`,
        SK: `ADDED_USERNAME#${cEmail}#premium`
      }
    }).promise();
    if (existing.Item) {
      return {
        success: true,
        message: 'Creator already in your premium feed.',
        subscriberEmail: vEmail,
        creatorEmail: cEmail
      };
    }

    await dynamodb.put({
      TableName: table,
      Item: {
        PK: `USER#${vEmail}`,
        SK: `ADDED_USERNAME#${cEmail}#premium`,
        status: 'active',
        streamerEmail: cEmail,
        streamerUsername: creatorUsername || null,
        streamerVisibility: 'premium',
        addedAt: now
      }
    }).promise();

    await dynamodb.put({
      TableName: table,
      Item: {
        PK: `STREAMER_FOLLOWERS#${cEmail}`,
        SK: `VIEWER#${vEmail}`,
        streamerVisibility: 'premium',
        status: 'active',
        addedAt: now
      }
    }).promise();

    return {
      success: true,
      message: 'Creator added to your premium feed. Their premium posts will appear in the Premium tab.',
      subscriberEmail: vEmail,
      creatorEmail: cEmail
    };
  } catch (error) {
    console.error('❌ [create-premium-subscription] Error:', error);
    return {
      success: false,
      message: error.statusMessage || error.message || 'Add premium creator failed'
    };
  }
});
