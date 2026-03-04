const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function testLookup() {
  const ownerEmail = 'dehyu.sinyan@gmail.com';
  const ownerUsername = 'Twilly TV';
  
  console.log(`Testing lookup for email: ${ownerEmail}, username: ${ownerUsername}`);
  
  // Test 1: Direct PROFILE lookup
  try {
    const profileParams = {
      TableName: table,
      Key: {
        PK: `USER#${ownerEmail.toLowerCase()}`,
        SK: 'PROFILE'
      }
    };
    
    const profileResult = await dynamodb.get(profileParams).promise();
    if (profileResult.Item) {
      console.log(`✅ PROFILE found:`);
      console.log(`   Username: "${profileResult.Item.username}"`);
      console.log(`   Email: ${profileResult.Item.email || 'not set'}`);
      console.log(`   PK: ${profileResult.Item.PK || 'not set'}`);
      
      const profileUsername = profileResult.Item.username;
      const match1 = profileUsername && profileUsername.toLowerCase().trim() === ownerUsername.toLowerCase().trim();
      const match2 = profileUsername && profileUsername.toLowerCase() === ownerUsername.toLowerCase();
      
      console.log(`   Match with .trim(): ${match1}`);
      console.log(`   Match without .trim(): ${match2}`);
    } else {
      console.log(`❌ PROFILE not found`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Test 2: GSI lookup
  const ownerUsernameLower = ownerUsername.toLowerCase();
  console.log(`\nTesting GSI lookup for username: "${ownerUsername}" (lower: "${ownerUsernameLower}")`);
  
  for (const visibility of ['public', 'private']) {
    const queryParams = {
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
      ExpressionAttributeValues: {
        ':visibility': visibility,
        ':username': ownerUsername
      },
      Limit: 1
    };
    
    try {
      const result = await dynamodb.query(queryParams).promise();
      if (result.Items && result.Items.length > 0) {
        const foundUser = result.Items[0];
        console.log(`✅ GSI ${visibility} exact match found:`);
        console.log(`   Username: "${foundUser.username}"`);
        console.log(`   Email: ${foundUser.email || foundUser.PK?.replace('USER#', '') || 'not set'}`);
        console.log(`   Match: ${foundUser.username && foundUser.username.toLowerCase() === ownerUsernameLower}`);
      }
    } catch (error) {
      console.log(`❌ GSI ${visibility} error: ${error.message}`);
    }
  }
}

testLookup().catch(console.error);
