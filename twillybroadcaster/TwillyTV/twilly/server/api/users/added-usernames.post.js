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
    let { userEmail } = body; // Use 'let' instead of 'const' to allow reassignment

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: userEmail'
      });
    }

    // CRITICAL: Normalize email to lowercase to prevent case-sensitivity issues
    // This ensures we query the same PK format that was used when creating ADDED_USERNAME entries
    userEmail = userEmail.toLowerCase();

    console.log(`📋 [added-usernames] Getting added usernames for ${userEmail}`);

    // Query for added usernames (only active ones)
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${userEmail}`,
        ':skPrefix': 'ADDED_USERNAME#',
        ':status': 'active'
      }
    };

    const result = await dynamodb.query(queryParams).promise();
    let addedUsernames = result.Items || [];

    // Get the user's own username to filter it out
    let userOwnUsername = null;
    try {
      const userProfileParams = {
        TableName: table,
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'PROFILE'
        }
      };
      const userProfileResult = await dynamodb.get(userProfileParams).promise();
      if (userProfileResult.Item && userProfileResult.Item.username) {
        userOwnUsername = userProfileResult.Item.username.toLowerCase().trim();
        console.log(`🔍 [added-usernames] User's own username: ${userProfileResult.Item.username}`);
      }
    } catch (error) {
      console.log(`⚠️ [added-usernames] Could not fetch user profile: ${error.message}`);
    }

    // CRITICAL: Filter out ANY username where the user added themselves
    // This includes:
    // 1. Current username matches
    // 2. streamerEmail matches userEmail (user added themselves, even with old username)
    // CRITICAL: Also filter out private usernames - they should NEVER appear in the public added list
    const beforeCount = addedUsernames.length;
    addedUsernames = addedUsernames.filter(item => {
      // CRITICAL: Filter out private usernames - check SK format first (most reliable)
      // New format: ADDED_USERNAME#email#public or ADDED_USERNAME#email#private
      // Old format: ADDED_USERNAME#email (check streamerVisibility field)
      // Safely access SK - it should always exist but be defensive
      const sk = (item && item.SK) ? String(item.SK) : '';
      const isPrivateBySK = sk && sk.includes('#private');
      
      // Also check streamerVisibility field (for old format entries or as backup)
      const visibility = (item.streamerVisibility || 'public').toLowerCase();
      const isPrivateByVisibility = visibility === 'private';
      
      // Check if username contains lock emoji (another indicator)
      const hasLockEmoji = (item.streamerUsername || '').includes('🔒');
      
      if (isPrivateBySK || isPrivateByVisibility || hasLockEmoji) {
        console.log(`🚫 [added-usernames] Filtering out private username: ${item.streamerUsername} (SK: ${sk}, visibility: ${visibility}, hasLock: ${hasLockEmoji})`);
        return false;
      }
      
      // Filter by current username match
      if (userOwnUsername) {
        const itemUsername = (item.streamerUsername || '').toLowerCase().trim().replace(/🔒/g, '');
        if (itemUsername === userOwnUsername) {
          console.log(`🚫 [added-usernames] Filtering out user's own username: ${item.streamerUsername}`);
          return false;
        }
      }
      
      // CRITICAL: Filter by email match - if streamerEmail matches userEmail, 
      // the user added themselves (regardless of username, current or old)
      if (item.streamerEmail && item.streamerEmail.toLowerCase().trim() === userEmail.toLowerCase().trim()) {
        console.log(`🚫 [added-usernames] Filtering out self-added username (email match): ${item.streamerUsername} (email: ${item.streamerEmail})`);
        return false;
      }
      
      return true;
    });
    
    if (beforeCount > addedUsernames.length) {
      console.log(`✅ [added-usernames] Filtered out ${beforeCount - addedUsernames.length} self-added username(s)`);
    }

    console.log(`✅ [added-usernames] Found ${addedUsernames.length} added usernames (after filtering own username)`);

    return {
      success: true,
      addedUsernames: addedUsernames.map(item => ({
        streamerEmail: item.streamerEmail,
        streamerUsername: item.streamerUsername,
        addedAt: item.addedAt,
        streamerVisibility: item.streamerVisibility
      })),
      count: addedUsernames.length
    };

  } catch (error) {
    console.error('❌ [added-usernames] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to get added usernames'
    });
  }
});
