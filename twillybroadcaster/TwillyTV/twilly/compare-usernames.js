const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

const usernames = ['dehsintv', 'dehswizzy', 'dehyuusername', 'dehsin35'];

async function compareUsernames() {
  console.log('🔍 Comparing usernames in database...\n');
  
  for (const username of usernames) {
    console.log(`\n📋 Checking: ${username}`);
    console.log('─'.repeat(50));
    
    // Check GSI for public
    console.log(`\n1️⃣ GSI Lookup (public):`);
    try {
      const gsiParams = {
        TableName: table,
        IndexName: 'UsernameSearchIndex',
        KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
        ExpressionAttributeValues: {
          ':visibility': 'public',
          ':username': username
        },
        Limit: 1
      };
      
      const gsiResult = await dynamodb.query(gsiParams).promise();
      if (gsiResult.Items && gsiResult.Items.length > 0) {
        const item = gsiResult.Items[0];
        console.log(`   ✅ FOUND in GSI`);
        console.log(`   PK: ${item.PK}`);
        console.log(`   SK: ${item.SK}`);
        console.log(`   username: "${item.username}"`);
        console.log(`   usernameVisibility: "${item.usernameVisibility}"`);
        console.log(`   email: ${item.email || item.PK?.replace('USER#', '') || 'N/A'}`);
      } else {
        console.log(`   ❌ NOT FOUND in GSI (public)`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    // Check PROFILE directly
    console.log(`\n2️⃣ PROFILE Lookup (scanning for username match):`);
    try {
      const scanParams = {
        TableName: table,
        FilterExpression: 'contains(username, :username)',
        ExpressionAttributeValues: {
          ':username': username
        },
        Limit: 5
      };
      
      const scanResult = await dynamodb.scan(scanParams).promise();
      const profiles = scanResult.Items.filter(item => item.SK === 'PROFILE');
      
      if (profiles.length > 0) {
        console.log(`   ✅ FOUND ${profiles.length} PROFILE(s)`);
        profiles.forEach((profile, idx) => {
          console.log(`\n   Profile ${idx + 1}:`);
          console.log(`   PK: ${profile.PK}`);
          console.log(`   SK: ${profile.SK}`);
          console.log(`   username: "${profile.username || 'MISSING'}"`);
          console.log(`   usernameVisibility: "${profile.usernameVisibility || 'MISSING'}"`);
          console.log(`   email: ${profile.email || profile.PK?.replace('USER#', '') || 'N/A'}`);
        });
      } else {
        console.log(`   ❌ NO PROFILE found with username containing "${username}"`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  }
  
  console.log('\n\n✅ Comparison complete!');
}

compareUsernames().catch(console.error);
