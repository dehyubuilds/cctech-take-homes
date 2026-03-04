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
    console.log('API - Updating creator username:', body);

    const { userId, username } = body;

    if (!userId || !username) {
      throw createError({
        statusCode: 400,
        message: 'User ID and username are required'
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

    // First, get the user's email from the Twilly table
    const getUserParams = {
      TableName: 'Twilly',
      Key: {
        PK: 'USER',
        SK: userId
      }
    };

    const userResult = await dynamoDb.get(getUserParams).promise();
    console.log('API - User lookup result:', userResult);

    let userEmail;
    
    if (!userResult.Item) {
      // User doesn't exist in Twilly table, create it
      console.log('API - User not found in Twilly table, creating new record');
      
      // Try to get user email from the request body or use default
      userEmail = body.email || `user-${userId}@twilly.app`;
      
      // Create the user record in Twilly table
      const createUserParams = {
        TableName: 'Twilly',
        Item: {
          PK: 'USER',
          SK: userId,
          email: userEmail,
          username: username,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
      
      await dynamoDb.put(createUserParams).promise();
      console.log('API - Created new user record in Twilly table');
    } else {
      userEmail = userResult.Item.email;
      console.log('API - Found user email:', userEmail);
    }

    // CRITICAL: Find ALL USER records with this email (there should only be 1, but handle duplicates)
    console.log(`🔍 [update-username] Finding ALL USER records with email: ${userEmail}`);
    const findDuplicatesParams = {
      TableName: 'Twilly',
      FilterExpression: 'PK = :pk AND email = :email',
      ExpressionAttributeValues: {
        ':pk': 'USER',
        ':email': userEmail
      }
    };

    const duplicatesResult = await dynamoDb.scan(findDuplicatesParams).promise();
    const allUserRecords = duplicatesResult.Items || [];
    
    console.log(`📋 [update-username] Found ${allUserRecords.length} USER record(s) with email ${userEmail}`);

    // If there are multiple records, we'll update all of them but keep the one with userId as primary
    if (allUserRecords.length > 1) {
      console.log(`⚠️ [update-username] Found ${allUserRecords.length} duplicate USER records! Will update all and delete duplicates.`);
      
      // Sort by updatedAt (most recent first), keep the one matching userId if it exists
      allUserRecords.sort((a, b) => {
        // Prioritize the one matching userId
        if (a.SK === userId) return -1;
        if (b.SK === userId) return 1;
        // Otherwise sort by updatedAt
        const aTime = a.updatedAt || a.createdAt || '0';
        const bTime = b.updatedAt || b.createdAt || '0';
        return bTime.localeCompare(aTime);
      });

      // Keep the first one (either userId match or most recent), delete the rest
      const keepRecord = allUserRecords[0];
      const deleteRecords = allUserRecords.slice(1);

      console.log(`✅ [update-username] Keeping USER record: SK=${keepRecord.SK}`);
      
      for (const record of deleteRecords) {
        console.log(`🗑️ [update-username] Deleting duplicate USER record: SK=${record.SK}, Username=${record.username || 'N/A'}`);
        try {
          const deleteParams = {
            TableName: 'Twilly',
            Key: {
              PK: 'USER',
              SK: record.SK
            }
          };
          await dynamoDb.delete(deleteParams).promise();
          console.log(`   ✅ Deleted duplicate record`);
        } catch (deleteError) {
          console.error(`   ❌ Error deleting duplicate: ${deleteError.message}`);
        }
      }
    }

    // Get the current user's record (should be the one we're keeping)
    const currentUserParams = {
      TableName: 'Twilly',
      Key: {
        PK: 'USER',
        SK: userId
      }
    };

    const currentUserResult = await dynamoDb.get(currentUserParams).promise();
    console.log('API - Current user record for update:', currentUserResult.Item);

    // If the current user already has this username, allow the update
    if (currentUserResult.Item && currentUserResult.Item.username === username) {
      console.log('API - User already has this username, allowing update');
    } else {
      // Check if username is already taken by another user
      const checkParams = {
        TableName: 'Twilly',
        FilterExpression: 'PK = :pk AND username = :username',
        ExpressionAttributeValues: {
          ':pk': 'USER',
          ':username': username
        }
      };

      const existingUsers = await dynamoDb.scan(checkParams).promise();
      
      // Filter out the current user from the results
      const otherUsersWithUsername = existingUsers.Items?.filter(user => user.SK !== userId) || [];
      
      if (otherUsersWithUsername.length > 0) {
        console.log('API - Username taken by other users:', otherUsersWithUsername.map(u => u.SK));
        throw createError({
          statusCode: 409,
          message: 'Username is already taken by another user'
        });
      }
    }

    // Update the user record in Twilly table with username
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: 'USER',
        SK: userId
      },
      UpdateExpression: 'SET username = :username, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':username': username,
        ':updatedAt': new Date().toISOString()
      }
    };

    console.log('API - DynamoDB update params:', updateParams);

    await dynamoDb.update(updateParams).promise();
    console.log('API - Username updated successfully in Twilly table');

    // CRITICAL: Also update PROFILE record to keep it in sync with USER record (source of truth)
    // This prevents mismatches where PROFILE has an old username
    // CRITICAL: Must set BOTH username AND usernameVisibility for GSI indexing
    try {
      const profileUpdateParams = {
        TableName: 'Twilly',
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'PROFILE'
        },
        UpdateExpression: 'SET username = :username, usernameVisibility = :visibility, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':username': username,
          ':visibility': 'public', // Default to public for GSI indexing
          ':updatedAt': new Date().toISOString()
        }
      };
      
      await dynamoDb.update(profileUpdateParams).promise();
      console.log('API - Username and usernameVisibility updated in PROFILE record (ensures GSI indexing)');
    } catch (profileError) {
      // Non-critical - PROFILE record might not exist for all users
      console.log('API - PROFILE record not found or error updating (non-critical):', profileError.message);
    }

    // CRITICAL: Delete ALL previous self-added usernames when username is updated
    // This prevents old usernames (like "robday") from persisting after username change
    try {
      console.log(`🧹 [update-username] Cleaning up all self-added usernames for ${userEmail}`);
      
      // Query all ADDED_USERNAME entries for this user
      const queryParams = {
        TableName: 'Twilly',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userEmail}`,
          ':skPrefix': 'ADDED_USERNAME#'
        }
      };

      const addedUsernamesResult = await dynamoDb.query(queryParams).promise();
      const addedUsernames = addedUsernamesResult.Items || [];
      
      // Find all entries where streamerEmail matches userEmail (user added themselves)
      const selfAddedEntries = addedUsernames.filter(item => {
        const streamerEmail = (item.streamerEmail || '').toLowerCase().trim();
        const userEmailLower = userEmail.toLowerCase().trim();
        return streamerEmail === userEmailLower;
      });

      console.log(`🧹 [update-username] Found ${selfAddedEntries.length} self-added username entries to delete`);

      // Delete all self-added entries
      let deletedCount = 0;
      for (const entry of selfAddedEntries) {
        try {
          const deleteParams = {
            TableName: 'Twilly',
            Key: {
              PK: entry.PK,
              SK: entry.SK
            }
          };
          await dynamoDb.delete(deleteParams).promise();
          deletedCount++;
          console.log(`🗑️ [update-username] Deleted self-added username: ${entry.streamerUsername || entry.SK}`);
        } catch (deleteError) {
          console.error(`❌ [update-username] Error deleting entry ${entry.SK}:`, deleteError.message);
        }
      }

      if (deletedCount > 0) {
        console.log(`✅ [update-username] Successfully deleted ${deletedCount} self-added username(s)`);
      }
    } catch (cleanupError) {
      // Non-critical - log but don't fail the username update
      console.error(`⚠️ [update-username] Error cleaning up self-added usernames:`, cleanupError.message);
    }

    // Also update STRIPE_CONNECT record if it exists (for consistency with channel guide)
    try {
      const stripeConnectParams = {
        TableName: 'Twilly',
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'STRIPE_CONNECT'
        }
      };
      
      const stripeConnectResult = await dynamoDb.get(stripeConnectParams).promise();
      if (stripeConnectResult.Item) {
        // Update the STRIPE_CONNECT record with the new username
        const updateStripeParams = {
          TableName: 'Twilly',
          Key: {
            PK: `USER#${userEmail}`,
            SK: 'STRIPE_CONNECT'
          },
          UpdateExpression: 'SET username = :username, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':username': username,
            ':updatedAt': new Date().toISOString()
          }
        };
        
        await dynamoDb.update(updateStripeParams).promise();
        console.log('API - Username also updated in STRIPE_CONNECT record');
      }
    } catch (error) {
      // Non-critical - STRIPE_CONNECT record might not exist for all users
      console.log('API - STRIPE_CONNECT record not found or error updating:', error.message);
    }

    return { 
      success: true,
      message: 'Username updated successfully',
      email: userEmail,
      username: username
    };
  } catch (error) {
    console.error('API - Unexpected error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
      details: error.details || error.stack
    });
  }
}); 