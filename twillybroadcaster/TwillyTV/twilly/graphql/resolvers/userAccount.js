// Resolver for userAccount query
// Returns user account information (username, email, etc.)
// This is a Lambda resolver - deploy as Lambda function and use as AppSync data source

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

exports.handler = async (event) => {
  console.log('userAccount resolver:', JSON.stringify(event, null, 2));
  
  const { userId } = event.arguments || {};
  
  if (!userId) {
    throw new Error('Missing required field: userId');
  }
  
  const tableName = 'Twilly';
  
  try {
    // Query DynamoDB for the user's record using userId as SK
    // Username is stored with PK='USER' and SK=userId
    const params = {
      TableName: tableName,
      Key: {
        PK: 'USER',
        SK: userId
      }
    };
    
    console.log('Querying DynamoDB for user:', userId);
    const result = await dynamodb.get(params).promise();
    
    if (!result.Item) {
      console.log('No user record found for userId:', userId);
      return {
        userId: userId,
        email: null,
        username: null,
        name: null
      };
    }
    
    const userRecord = result.Item;
    const username = userRecord.username || null;
    const email = userRecord.email || null;
    const name = userRecord.name || null;
    
    console.log('Found user account:', { userId, username, email, name });
    
    return {
      userId: userId,
      email: email,
      username: username,
      name: name
    };
  } catch (error) {
    console.error('Error in userAccount resolver:', error);
    throw error;
  }
};

