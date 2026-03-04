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
    let { userEmail, isPublic } = body; // Use 'let' instead of 'const' to allow reassignment

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: userEmail'
      });
    }

    // CRITICAL: Normalize email to lowercase to prevent case-sensitivity issues
    userEmail = userEmail.toLowerCase();

    // Support both old boolean format and new string format (public/private/premium)
    let usernameVisibility;
    if (typeof isPublic === 'boolean') {
      // Legacy boolean format
      usernameVisibility = isPublic ? 'public' : 'private';
    } else if (body.usernameVisibility && ['public', 'private', 'premium'].includes(body.usernameVisibility)) {
      // New string format
      usernameVisibility = body.usernameVisibility;
    } else {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: isPublic (boolean) or usernameVisibility (string: public/private/premium)'
      });
    }

    // CRITICAL: Normalize email to lowercase to prevent case-sensitivity issues
    userEmail = userEmail.toLowerCase();

    console.log(`🔒 [set-visibility] Setting username visibility for ${userEmail} to ${usernameVisibility}`);

    // Get current user profile
    const getParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      }
    };

    const userResult = await dynamodb.get(getParams).promise();

    // If user profile doesn't exist, create it with the visibility setting
    if (!userResult.Item) {
      console.log(`⚠️ [set-visibility] User profile not found for ${userEmail}, creating new profile`);
      
      // Try to get username from USER record if it exists
      let username = null;
      try {
        // Try to find USER record by email
        const userScanParams = {
          TableName: table,
          FilterExpression: 'PK = :pk AND email = :email',
          ExpressionAttributeValues: {
            ':pk': 'USER',
            ':email': userEmail
          },
          Limit: 1
        };
        const userResult = await dynamodb.scan(userScanParams).promise();
        if (userResult.Items && userResult.Items.length > 0) {
          username = userResult.Items[0].username;
        }
      } catch (error) {
        // Ignore - username will be null
      }
      
      const createParams = {
        TableName: table,
        Item: {
          PK: `USER#${userEmail}`,
          SK: 'PROFILE',
          usernameVisibility: usernameVisibility,
          ...(username ? { username: username } : {}), // Include username if found
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      await dynamodb.put(createParams).promise();
      
      return {
        success: true,
        message: `Username visibility set to ${usernameVisibility}`,
        usernameVisibility: usernameVisibility,
        isPublic: usernameVisibility === 'public'
      };
    }

    // Update user profile with visibility setting
    const updateParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      },
      UpdateExpression: 'SET usernameVisibility = :visibility, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':visibility': usernameVisibility,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(updateParams).promise();

    console.log(`✅ [set-visibility] Username visibility updated successfully`);

    return {
      success: true,
      message: `Username visibility set to ${usernameVisibility}`,
      usernameVisibility: usernameVisibility,
      isPublic: usernameVisibility === 'public'
    };

  } catch (error) {
    console.error('❌ [set-visibility] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to update username visibility'
    });
  }
});
