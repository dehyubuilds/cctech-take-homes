const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function updateSubscription() {
  try {
    console.log('Updating subscription status to active...');
    
    const result = await dynamodb.update({
      TableName: 'Twilly',
      Key: {
        PK: 'SUBSCRIBER#dehyu.sinyan@gmail.com',
        SK: 'CHANNEL#dehsin365-Eatabarbie TV'
      },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'active',
        ':updatedAt': new Date().toISOString()
      }
    }).promise();
    
    console.log('✅ Subscription updated successfully:', result);
    
  } catch (error) {
    console.error('❌ Error updating subscription:', error);
  }
}

updateSubscription(); 