const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkProfileUsername() {
  try {
    const userEmail = 'dehyubuilds@gmail.com';
    
    console.log(`🔍 Checking PROFILE username for: ${userEmail}`);
    console.log(`   PK: USER#${userEmail}`);
    console.log(`   SK: PROFILE`);
    
    const params = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (result.Item) {
      console.log(`\n✅ Found PROFILE:`);
      console.log(JSON.stringify(result.Item, null, 2));
      console.log(`\n📊 Key fields:`);
      console.log(`   username: ${result.Item.username || 'NOT SET'}`);
      console.log(`   usernameVisibility: ${result.Item.usernameVisibility || 'NOT SET'}`);
      console.log(`   privateUsername: ${result.Item.privateUsername || 'NOT SET'}`);
      
      if (result.Item.username) {
        console.log(`\n✅ PROFILE username is: "${result.Item.username}"`);
        console.log(`   This is the username that should ALWAYS be used.`);
      } else {
        console.log(`\n⚠️  WARNING: PROFILE username is NOT SET!`);
      }
    } else {
      console.log(`\n❌ PROFILE does NOT exist!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkProfileUsername()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
