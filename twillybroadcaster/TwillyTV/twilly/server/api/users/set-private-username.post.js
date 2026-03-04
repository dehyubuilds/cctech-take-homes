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
    const { userEmail, privateUsername } = body;

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: userEmail'
      });
    }

    console.log(`🔒 [set-private-username] Setting private username for ${userEmail} to ${privateUsername || 'null'}`);

    // Get current user profile
    const getParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      }
    };

    const userResult = await dynamodb.get(getParams).promise();

    // If user profile doesn't exist, create it
    if (!userResult.Item) {
      console.log(`⚠️ [set-private-username] User profile not found for ${userEmail}, creating new profile`);
      
      // If setting a private username, account should be private; otherwise public
      const usernameVisibility = privateUsername ? 'private' : 'public';
      
      // Try to get username from USER record if it exists
      let username = null;
      try {
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
          privateUsername: privateUsername || null,
          usernameVisibility: usernameVisibility, // CRITICAL: Set visibility for GSI indexing
          ...(username ? { username: username } : {}), // CRITICAL: Include username for GSI indexing
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      await dynamodb.put(createParams).promise();
      
      console.log(`✅ [set-private-username] Created profile with usernameVisibility: ${usernameVisibility}`);
      
      return {
        success: true,
        message: `Private username ${privateUsername ? 'set' : 'removed'}`,
        privateUsername: privateUsername || null,
        usernameVisibility: usernameVisibility
      };
    }

    // Update user profile with private username AND usernameVisibility
    // If setting privateUsername, account should be private; if removing it, check current state
    const hasPrivateUsername = !!privateUsername;
    const currentVisibility = userResult.Item.usernameVisibility || 'public';
    
    // Determine new visibility:
    // - If setting privateUsername, always set to private
    // - If removing privateUsername, set to public (unless user explicitly set it to private via set-visibility)
    // Actually, if removing privateUsername, we should keep current visibility unless it was only private because of privateUsername
    // For simplicity: if setting privateUsername -> private, if removing -> public
    const newVisibility = hasPrivateUsername ? 'private' : 'public';
    
    const updateParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      },
      UpdateExpression: 'SET privateUsername = :privateUsername, usernameVisibility = :visibility, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':privateUsername': privateUsername || null,
        ':visibility': newVisibility, // CRITICAL: Update visibility for GSI indexing
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(updateParams).promise();

    console.log(`✅ [set-private-username] Private username updated successfully, usernameVisibility set to: ${newVisibility}`);

    return {
      success: true,
      message: `Private username ${privateUsername ? 'set' : 'removed'}`,
      privateUsername: result.Attributes?.privateUsername || null,
      usernameVisibility: newVisibility
    };

  } catch (error) {
    console.error('❌ [set-private-username] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to update private username'
    });
  }
});
