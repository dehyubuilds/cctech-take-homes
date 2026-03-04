const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkTwillyTVVersions() {
  try {
    const targetUsername = 'Twilly TV';
    const email = 'dehyu.sinyan@gmail.com';
    
    console.log(`🔍 Checking if "${targetUsername}" has both public and private versions...`);
    
    // Check PROFILE
    const profileParams = {
      TableName: table,
      Key: {
        PK: `USER#${email}`,
        SK: 'PROFILE'
      }
    };
    
    const profileResult = await dynamodb.get(profileParams).promise();
    if (profileResult.Item) {
      console.log(`\n📋 PROFILE:`);
      console.log(`   username: ${profileResult.Item.username}`);
      console.log(`   usernameVisibility: ${profileResult.Item.usernameVisibility}`);
      console.log(`   privateUsername: ${profileResult.Item.privateUsername || 'NOT SET'}`);
    }
    
    // Check STREAM_KEY mappings for private version
    console.log(`\n🔍 Checking STREAM_KEY mappings for private streams...`);
    const streamKeyParams = {
      TableName: table,
      KeyConditionExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      FilterExpression: 'contains(username, :username)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'STREAM_KEY#',
        ':skPrefix': 'MAPPING#',
        ':username': targetUsername
      }
    };
    
    try {
      const streamKeyResult = await dynamodb.query(streamKeyParams).promise();
      if (streamKeyResult.Items && streamKeyResult.Items.length > 0) {
        console.log(`\n✅ Found ${streamKeyResult.Items.length} STREAM_KEY mappings:`);
        streamKeyResult.Items.forEach((item, index) => {
          console.log(`   ${index + 1}. Username: ${item.username}`);
          console.log(`      Email: ${item.email}`);
          console.log(`      Has 🔒: ${item.username?.includes('🔒') ? 'YES' : 'NO'}`);
        });
      } else {
        console.log(`\n⚠️  No STREAM_KEY mappings found with username "${targetUsername}"`);
      }
    } catch (error) {
      console.log(`\n⚠️  Could not query STREAM_KEY: ${error.message}`);
    }
    
    // Check if there are any private streams (content with isPrivateUsername=true)
    console.log(`\n🔍 Checking for private content (isPrivateUsername=true)...`);
    const contentParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'isPrivateUsername = :isPrivate',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':skPrefix': 'FILE#',
        ':isPrivate': true
      },
      Limit: 5
    };
    
    try {
      const contentResult = await dynamodb.query(contentParams).promise();
      if (contentResult.Items && contentResult.Items.length > 0) {
        console.log(`\n✅ Found ${contentResult.Items.length} private content items`);
        console.log(`   This means the account has private content`);
      } else {
        console.log(`\n⚠️  No private content found`);
        console.log(`   This might mean the account doesn't have private streams`);
      }
    } catch (error) {
      console.log(`\n⚠️  Could not query content: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkTwillyTVVersions()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
