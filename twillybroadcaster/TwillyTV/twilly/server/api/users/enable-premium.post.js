import AWS from 'aws-sdk';

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
    const { userEmail, enable } = body;

    if (!userEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: userEmail'
      });
    }

    if (typeof enable !== 'boolean') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required field: enable (boolean)'
      });
    }

    console.log(`💰 [enable-premium] ${enable ? 'Enabling' : 'Disabling'} Premium for ${userEmail}`);

    // Get current profile
    const profileResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      }
    }).promise();

    // Update or create profile with premium flag
    if (!profileResult.Item) {
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
      
      // Create new profile
      await dynamodb.put({
        TableName: table,
        Item: {
          PK: `USER#${userEmail}`,
          SK: 'PROFILE',
          isPremiumEnabled: enable,
          usernameVisibility: 'public', // Default
          ...(username ? { username: username } : {}), // CRITICAL: Include username for GSI indexing
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }).promise();
    } else {
      // Update existing profile
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'PROFILE'
        },
        UpdateExpression: 'SET isPremiumEnabled = :enable, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':enable': enable,
          ':updatedAt': new Date().toISOString()
        }
      }).promise();
    }

    // If enabling premium, also update usernameVisibility to include premium option
    // But don't change it if user has explicitly set it to private
    if (enable && profileResult.Item?.usernameVisibility !== 'private') {
      // Allow premium visibility - user can still choose public/private/premium when streaming
      // We don't force change visibility here, just enable the premium option
    }

    console.log(`✅ [enable-premium] Premium ${enable ? 'enabled' : 'disabled'} successfully`);

    return {
      success: true,
      message: `Premium ${enable ? 'enabled' : 'disabled'} successfully`,
      isPremiumEnabled: enable
    };

  } catch (error) {
    console.error('❌ [enable-premium] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to enable/disable Premium'
    });
  }
});
