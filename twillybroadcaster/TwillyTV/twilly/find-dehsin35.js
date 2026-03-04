const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findDehsin35() {
  console.log('🔍 Searching for "dehsin35" in all possible locations...\n');
  
  // 1. Check STREAM_KEY#MAPPING
  console.log('1️⃣ Checking STREAM_KEY#MAPPING...');
  try {
    const scanParams = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pk) AND SK = :sk AND contains(streamUsername, :username)',
      ExpressionAttributeValues: {
        ':pk': 'STREAM_KEY#',
        ':sk': 'MAPPING',
        ':username': 'dehsin35'
      },
      Limit: 10
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    if (result.Items && result.Items.length > 0) {
      console.log(`   ✅ FOUND ${result.Items.length} STREAM_KEY#MAPPING entry(ies):`);
      result.Items.forEach((item, idx) => {
        console.log(`\n   Entry ${idx + 1}:`);
        console.log(`   PK: ${item.PK}`);
        console.log(`   SK: ${item.SK}`);
        console.log(`   streamUsername: "${item.streamUsername}"`);
        console.log(`   userEmail: ${item.userEmail || item.email || 'N/A'}`);
      });
    } else {
      console.log(`   ❌ NOT FOUND in STREAM_KEY#MAPPING`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
  
  // 2. Check all PROFILE entries (broader scan)
  console.log('\n2️⃣ Checking all PROFILE entries...');
  try {
    const scanParams = {
      TableName: table,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':sk': 'PROFILE'
      },
      Limit: 100
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    const matching = result.Items.filter(item => 
      item.username && item.username.toLowerCase().includes('dehsin35')
    );
    
    if (matching.length > 0) {
      console.log(`   ✅ FOUND ${matching.length} PROFILE(s) with username containing "dehsin35":`);
      matching.forEach((profile, idx) => {
        console.log(`\n   Profile ${idx + 1}:`);
        console.log(`   PK: ${profile.PK}`);
        console.log(`   SK: ${profile.SK}`);
        console.log(`   username: "${profile.username}"`);
        console.log(`   usernameVisibility: "${profile.usernameVisibility || 'MISSING'}"`);
        console.log(`   email: ${profile.email || profile.PK?.replace('USER#', '') || 'N/A'}`);
      });
    } else {
      console.log(`   ❌ NO PROFILE found with username containing "dehsin35"`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
  
  // 3. Check GSI with case variations
  console.log('\n3️⃣ Checking GSI with case variations...');
  const variations = ['dehsin35', 'Dehsin35', 'DEHSIN35'];
  for (const variation of variations) {
    try {
      const gsiParams = {
        TableName: table,
        IndexName: 'UsernameSearchIndex',
        KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
        ExpressionAttributeValues: {
          ':visibility': 'public',
          ':username': variation
        },
        Limit: 1
      };
      
      const result = await dynamodb.query(gsiParams).promise();
      if (result.Items && result.Items.length > 0) {
        console.log(`   ✅ FOUND in GSI with variation "${variation}"`);
        const item = result.Items[0];
        console.log(`   username: "${item.username}"`);
        console.log(`   PK: ${item.PK}`);
      }
    } catch (error) {
      // Ignore
    }
  }
  
  console.log('\n✅ Search complete!');
}

findDehsin35().catch(console.error);
