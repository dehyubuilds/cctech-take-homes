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
  console.log('🔌 WebSocket Disconnect:', JSON.stringify(event, null, 2));
  
  const connectionId = event.requestContext.connectionId;
  
  try {
    // Find and delete connection from DynamoDB
    const scanParams = {
      TableName: table,
      FilterExpression: 'connectionId = :connectionId',
      ExpressionAttributeValues: {
        ':connectionId': connectionId
      }
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    
    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        await dynamodb.delete({
          TableName: table,
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }).promise();
      }
      console.log(`✅ [websocket-comments-disconnect] Connection removed: ${connectionId}`);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnected' })
    };
  } catch (error) {
    console.error('❌ [websocket-comments-disconnect] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to disconnect' })
    };
  }
};
