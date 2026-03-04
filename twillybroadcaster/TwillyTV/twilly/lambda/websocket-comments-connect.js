const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = process.env.TABLE_NAME || 'Twilly';

exports.handler = async (event) => {
  console.log('🔌 WebSocket Connect:', JSON.stringify(event, null, 2));
  
  const connectionId = event.requestContext.connectionId;
  const queryParams = event.queryStringParameters || {};
  const userEmail = queryParams.userEmail;
  
  if (!userEmail) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'userEmail query parameter required' })
    };
  }
  
  try {
    // Store connection in DynamoDB
    const connectionItem = {
      PK: `WEBSOCKET#${userEmail.toLowerCase()}`,
      SK: `CONNECTION#${connectionId}`,
      connectionId: connectionId,
      userEmail: userEmail.toLowerCase(),
      connectedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours TTL
    };
    
    await dynamodb.put({
      TableName: table,
      Item: connectionItem
    }).promise();
    
    console.log(`✅ [websocket-comments-connect] Connection stored: ${connectionId} for user: ${userEmail}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Connected' })
    };
  } catch (error) {
    console.error('❌ [websocket-comments-connect] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to connect' })
    };
  }
};
