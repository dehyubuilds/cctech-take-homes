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
    userEmail = userEmail.toLowerCase();

    console.log(`🔍 [get-visibility] Getting username visibility for ${userEmail}`);

    // Get user profile
    const getParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      }
    };

    const result = await dynamodb.get(getParams).promise();

    // If user profile doesn't exist, default to public (don't throw error)
    if (!result.Item) {
      console.log(`⚠️ [get-visibility] User profile not found for ${userEmail}, defaulting to public`);
      return {
        success: true,
        usernameVisibility: 'public',
        isPublic: true
      };
    }

    // Default to public if not set
    const visibility = result.Item.usernameVisibility || 'public';
    const isPublic = visibility === 'public';

    console.log(`✅ [get-visibility] Username visibility: ${visibility}`);

    return {
      success: true,
      usernameVisibility: visibility,
      isPublic: isPublic
    };

  } catch (error) {
    console.error('❌ [get-visibility] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to get username visibility'
    });
  }
});
