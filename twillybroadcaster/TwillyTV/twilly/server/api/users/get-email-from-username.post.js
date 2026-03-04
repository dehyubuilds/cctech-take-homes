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
    const { username } = body;

    console.log('Get email from username request:', { username });

    if (!username || username.trim().length === 0) {
      return {
        success: false,
        message: 'Missing required field: username',
        email: null
      };
    }

    // Search for user by username in DynamoDB
    // Usernames are stored in USER records with SK = PROFILE
    // PK format: USER#email
    const searchParams = {
      TableName: table,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':sk': 'PROFILE'
      }
    };

    const result = await dynamodb.scan(searchParams).promise();
    const users = result.Items || [];

    // Find user with case-insensitive username match
    const trimmedUsername = username.trim().toLowerCase();
    const user = users.find(item => 
      item.username && item.username.trim().toLowerCase() === trimmedUsername
    );

    if (!user) {
      console.log(`No user found with username: ${username}`);
      return {
        success: false,
        message: `User with username '${username}' not found`,
        email: null
      };
    }
    // Extract email from PK (USER#email) or from email/userEmail field
    const email = user.email || user.userEmail || user.PK?.replace('USER#', '');

    if (!email) {
      return {
        success: false,
        message: 'Could not determine email for this username',
        email: null
      };
    }

    console.log(`Found email ${email} for username: ${username}`);

    return {
      success: true,
      message: 'Email retrieved successfully',
      email: email,
      userId: user.userId || user.PK?.replace('USER#', '')
    };

  } catch (error) {
    console.error('Error in get-email-from-username:', error);
    return {
      success: false,
      message: 'Failed to get email from username',
      email: null
    };
  }
});
