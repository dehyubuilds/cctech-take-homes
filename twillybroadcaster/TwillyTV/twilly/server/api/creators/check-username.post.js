import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    console.log('API - Checking username availability:', body);

    const { username, userId } = body;

    console.log('API - Received request:', { username, userId });

    if (!username || !userId) {
      throw createError({
        statusCode: 400,
        message: 'Username and user ID are required'
      });
    }

    // Validate username format
    if (username.length < 3) {
      throw createError({
        statusCode: 400,
        message: 'Username must be at least 3 characters'
      });
    }

    if (!/^[a-zA-Z0-9_\s-]+$/.test(username)) {
      throw createError({
        statusCode: 400,
        message: 'Username can only contain letters, numbers, spaces, hyphens, and underscores'
      });
    }

    // First, get the current user's record to see if they already have this username
    const currentUserParams = {
      TableName: 'Twilly',
      Key: {
        PK: 'USER',
        SK: userId
      }
    };

    const currentUserResult = await dynamoDb.get(currentUserParams).promise();
    console.log('API - Current user record:', currentUserResult.Item);
    console.log('API - Looking for user with SK:', userId);

    // If the current user already has this username, it's available to them
    if (currentUserResult.Item && currentUserResult.Item.username === username) {
      console.log('API - User already has this username, marking as available');
      return { 
        success: true,
        available: true,
        username: username,
        reason: 'current_user_username'
      };
    }

    // OPTIMIZED: Use GSI for fast username availability check
    // GSI: UsernameSearchIndex
    let otherUsersWithUsername = [];
    let useGSI = true;
    let existingUsers = null; // Initialize to avoid undefined error
    let totalUsersFound = 0;
    
    try {
      // Query both public and private partitions
      // Note: GSI query is case-sensitive, so we need to query with exact case
      // But we'll also do case-insensitive filtering to catch any variations
      const usernameLower = username.toLowerCase();
      
      for (const visibility of ['public', 'private']) {
        // Try exact case first
        const queryParams = {
          TableName: 'Twilly',
          IndexName: 'UsernameSearchIndex',
          KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
          ExpressionAttributeValues: {
            ':visibility': visibility,
            ':username': username // Exact match (case-sensitive)
          }
        };
        
        try {
          const result = await dynamoDb.query(queryParams).promise();
          if (result.Items && result.Items.length > 0) {
            totalUsersFound += result.Items.length;
            // Filter out current user and check case-insensitive match
            const matching = result.Items.filter(user => {
              const matchesUsername = user.username && user.username.toLowerCase() === usernameLower;
              const isNotCurrentUser = user.userId !== userId && user.SK !== userId;
              return matchesUsername && isNotCurrentUser;
            });
            otherUsersWithUsername = otherUsersWithUsername.concat(matching);
          }
        } catch (queryError) {
          // If this specific query fails, continue to next visibility
          console.log(`API - Query failed for visibility ${visibility}:`, queryError.message);
        }
      }
      
      // If GSI found results, we're done
      if (otherUsersWithUsername.length > 0 || totalUsersFound > 0) {
        console.log('API - Checked username availability via GSI');
      } else {
        // GSI didn't find anything, but might be case mismatch - fall back to scan for safety
        console.log('API - GSI found no matches, using scan as fallback for case-insensitive check');
        useGSI = false;
      }
    } catch (error) {
      // If GSI doesn't exist yet, fall back to scan
      if (error.code === 'ResourceNotFoundException' || 
          error.message.includes('index') || 
          error.message.includes('UsernameSearchIndex')) {
        console.log('API - GSI not available, falling back to scan...');
        useGSI = false;
      } else {
        console.log('API - GSI error, falling back to scan:', error.message);
        useGSI = false;
      }
    }
    
    // Fallback to scan if GSI not available or didn't find matches
    if (!useGSI) {
      const checkParams = {
        TableName: 'Twilly',
        FilterExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'USER'
        }
      };

      console.log('API - Scanning table for username availability');

      existingUsers = await dynamoDb.scan(checkParams).promise();
      
      // Filter for case-insensitive username match and exclude current user
      if (existingUsers && existingUsers.Items) {
        const usernameLower = username.toLowerCase();
        otherUsersWithUsername = existingUsers.Items.filter(user => {
          const userUsername = user.username || '';
          const matchesUsername = userUsername.toLowerCase() === usernameLower;
          const isNotCurrentUser = user.SK !== userId && user.userId !== userId;
          return matchesUsername && isNotCurrentUser;
        });
        totalUsersFound = existingUsers.Items.filter(user => {
          const userUsername = user.username || '';
          return userUsername.toLowerCase() === username.toLowerCase();
        }).length;
      }
    }
    
    const isAvailable = otherUsersWithUsername.length === 0;
    
    console.log('API - Username availability result:', {
      username,
      isAvailable,
      currentUserHasUsername: currentUserResult.Item?.username === username,
      totalUsersWithUsername: totalUsersFound || (existingUsers?.Items?.length || 0),
      otherUsersWithUsername: otherUsersWithUsername.length,
      otherUserIds: otherUsersWithUsername.map(u => u.SK || u.userId)
    });

    return { 
      success: true,
      available: isAvailable,
      username: username
    };
  } catch (error) {
    console.error('API - Error checking username availability:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
      details: error.details || error.stack
    });
  }
}); 