const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkYessUsername() {
  console.log('🔍 Checking "yess" username profile...\n');
  
  try {
    const userId = '86326e3d-af6e-4b85-b4b9-38a5695342fc';
    const email = 'dehyubuilds@gmail.com';
    
    // Check profile by userId
    console.log('1️⃣ Checking profile by userId:');
    const userParams = {
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE'
      }
    };
    
    const userResult = await dynamodb.get(userParams).promise();
    
    if (userResult.Item) {
      console.log('   ✅ Found profile:');
      console.log(`      username: ${userResult.Item.username || 'MISSING'}`);
      console.log(`      email: ${userResult.Item.email || 'MISSING'}`);
      console.log(`      PK: ${userResult.Item.PK || 'MISSING'}`);
    } else {
      console.log('   ❌ Profile NOT FOUND by userId');
    }
    console.log('');
    
    // Check profile by email
    console.log('2️⃣ Checking profile by email:');
    const emailParams = {
      TableName: table,
      Key: {
        PK: `USER#${email}`,
        SK: 'PROFILE'
      }
    };
    
    const emailResult = await dynamodb.get(emailParams).promise();
    
    if (emailResult.Item) {
      console.log('   ✅ Found profile:');
      console.log(`      username: ${emailResult.Item.username || 'MISSING'}`);
      console.log(`      email: ${emailResult.Item.email || 'MISSING'}`);
    } else {
      console.log('   ❌ Profile NOT FOUND by email');
    }
    console.log('');
    
    // Check if "yess" is actually an active username or should be removed from invalid list
    console.log('3️⃣ Checking if "yess" should be allowed:');
    console.log('   If "yess" is a valid collaborator username, it should be removed from invalid list');
    console.log('   If "yess" is an old/test username, the collaborator needs to update their username');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkYessUsername().catch(console.error);
