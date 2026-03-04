import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userId, email } = body;

    console.log('API - Fetching username for:', { userId, email });

    if (!userId || !email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'userId and email are required'
      });
    }

    // CRITICAL: Normalize email to lowercase to prevent case-sensitivity issues
    const normalizedEmail = email ? email.toLowerCase() : null;
    
    // CRITICAL: PROFILE.username is the SINGLE SOURCE OF TRUTH
    // Always check PROFILE first (PK='USER#email', SK='PROFILE')
    // This is what's displayed in account settings and should be used everywhere
    if (normalizedEmail) {
      const profileParams = {
        TableName: 'Twilly',
        Key: {
          PK: `USER#${normalizedEmail}`,
          SK: 'PROFILE'
        }
      };

      console.log('API - Querying PROFILE (source of truth):', profileParams);
      let result = await dynamodb.get(profileParams).promise();

      if (result.Item && result.Item.username) {
        const username = result.Item.username;
        console.log('API - Found username in PROFILE (source of truth):', username);
        return {
          username: username,
          found: true
        };
      }
    }

    // Fallback: Try PK='USER#userId', SK='PROFILE' if email lookup failed
    const profileParams2 = {
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE'
      }
    };

    console.log('API - Trying PROFILE with userId:', profileParams2);
    let result = await dynamodb.get(profileParams2).promise();

    if (result.Item && result.Item.username) {
      const username = result.Item.username;
      console.log('API - Found username in PROFILE (userId lookup):', username);
      return {
        username: username,
        found: true
      };
    }

    // Legacy fallback: Try PK='USER', SK=userId (old format, not source of truth)
    const legacyParams = {
      TableName: 'Twilly',
      Key: {
        PK: 'USER',
        SK: userId
      }
    };

    console.log('API - Trying legacy location (not source of truth):', legacyParams);
    result = await dynamodb.get(legacyParams).promise();

    if (result.Item && result.Item.username) {
      const username = result.Item.username;
      console.log('⚠️ API - Found username in legacy location (not source of truth):', username);
      console.log('   Consider migrating this user to PROFILE format');
      return {
        username: username,
        found: true
      };
    }

    console.log('API - No user record found in any location');
    return {
        username: '',
        found: false
      };

  } catch (error) {
    console.error('API - Error fetching username:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch username from database'
    });
  }
}); 