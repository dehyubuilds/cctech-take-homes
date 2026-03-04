const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkAllAddedUsernames() {
  console.log('🔍 [DEBUG] Checking all ADDED_USERNAME entries for Twilly TV account...\n');
  
  const twillyTVEmail = 'dehyu.sinyan@gmail.com';
  
  try {
    const params = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${twillyTVEmail.toLowerCase()}`,
        ':skPrefix': 'ADDED_USERNAME#'
      }
    };
    
    const result = await dynamodb.query(params).promise();
    
    console.log(`Found ${result.Items?.length || 0} ADDED_USERNAME entries:\n`);
    
    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        console.log(`- SK: ${item.SK}`);
        console.log(`  streamerUsername: "${item.streamerUsername || 'NOT SET'}"`);
        console.log(`  streamerVisibility: "${item.streamerVisibility || 'NOT SET'}"`);
        console.log(`  status: "${item.status || 'NOT SET'}"`);
        console.log(`  streamerEmail: "${item.streamerEmail || 'NOT SET'}"`);
        console.log(`  addedAt: ${item.addedAt || 'NOT SET'}`);
        console.log('');
      }
    } else {
      console.log('❌ NO ADDED_USERNAME entries found!');
      console.log(`   This means the "Add" button didn't create an entry, or it failed.`);
    }
    
    // Also check for POM-J specifically with different email formats
    console.log('\n🔍 Checking for POM-J with different email formats...');
    const pomJEmails = ['pomjfitness@gmail.com', 'POMJfitness@gmail.com', 'POM-J@gmail.com'];
    
    for (const email of pomJEmails) {
      const checkParams = {
        TableName: table,
        Key: {
          PK: `USER#${twillyTVEmail.toLowerCase()}`,
          SK: `ADDED_USERNAME#${email.toLowerCase()}`
        }
      };
      const checkResult = await dynamodb.get(checkParams).promise();
      if (checkResult.Item) {
        console.log(`✅ Found entry for ${email}:`);
        console.log(`   ${JSON.stringify(checkResult.Item, null, 2)}`);
      } else {
        console.log(`❌ No entry for ${email}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllAddedUsernames().catch(console.error);
