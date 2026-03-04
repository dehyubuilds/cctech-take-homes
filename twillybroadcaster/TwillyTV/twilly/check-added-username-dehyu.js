const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkAddedUsername() {
  try {
    const requesterEmail = 'dehyubuilds@gmail.com'; // dehyuusername
    const requestedUserEmail = 'dehyu.sinyan@gmail.com'; // Twilly TV
    
    console.log(`🔍 Checking if ${requesterEmail} has ${requestedUserEmail} in addedUsernames...`);
    
    const params = {
      TableName: table,
      Key: {
        PK: `USER#${requesterEmail.toLowerCase()}`,
        SK: `ADDED_USERNAME#${requestedUserEmail.toLowerCase()}`
      }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (result.Item) {
      console.log('✅ ADDED_USERNAME entry exists:');
      console.log(`   Streamer Username: ${result.Item.streamerUsername}`);
      console.log(`   Streamer Email: ${result.Item.streamerEmail}`);
      console.log(`   Streamer Visibility: ${result.Item.streamerVisibility}`);
      console.log(`   Status: ${result.Item.status}`);
      console.log(`   Added At: ${result.Item.addedAt}`);
      console.log(`   Accepted At: ${result.Item.acceptedAt || 'N/A'}`);
    } else {
      console.log('❌ ADDED_USERNAME entry NOT FOUND!');
      console.log('   This means the request was accepted but ADDED_USERNAME was not created.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAddedUsername();
