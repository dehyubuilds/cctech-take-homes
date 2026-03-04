const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkPOMJProfile() {
  console.log('🔍 [DEBUG] Checking POM-J profile visibility...\n');
  
  const pomJEmail = 'pomjfitness@gmail.com';
  
  try {
    const params = {
      TableName: table,
      Key: {
        PK: `USER#${pomJEmail.toLowerCase()}`,
        SK: 'PROFILE'
      }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (result.Item) {
      console.log('✅ Found POM-J PROFILE:');
      console.log(JSON.stringify(result.Item, null, 2));
      console.log('\n🔍 Visibility Analysis:');
      console.log(`   visibility: "${result.Item.visibility || 'NOT SET'}" (type: ${typeof result.Item.visibility})`);
      console.log(`   visibility check: ${result.Item.visibility && result.Item.visibility.toLowerCase() === 'public' ? '✅ WOULD AUTO-ACCEPT' : '❌ WOULD NOT AUTO-ACCEPT'}`);
      
      if (!result.Item.visibility) {
        console.log('\n❌ ISSUE FOUND: visibility is NOT SET!');
        console.log('   The auto-accept logic requires visibility === "public"');
        console.log('   Since visibility is not set, the condition fails and no ADDED_USERNAME is created.');
      } else if (result.Item.visibility.toLowerCase() !== 'public') {
        console.log(`\n❌ ISSUE FOUND: visibility is "${result.Item.visibility}", not "public"`);
        console.log('   The auto-accept logic requires visibility === "public"');
      }
    } else {
      console.log('❌ No PROFILE found for POM-J');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPOMJProfile().catch(console.error);
