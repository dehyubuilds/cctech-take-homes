const AWS = require('aws-sdk');
require('dotenv').config();

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
  
  console.log(`\n🔍 Testing lookup for:`);
  console.log(`   Email: ${ownerEmail}`);
  console.log(`   Username: ${ownerUsername}\n`);
  
  // Test 1: Direct PROFILE lookup by email
  console.log(`📋 TEST 1: Direct PROFILE lookup by email`);
  try {
    const normalizedEmail = ownerEmail.toLowerCase().trim();
    const profileParams = {
      TableName: table,
      Key: {
        PK: `USER#${normalizedEmail}`,
        SK: 'PROFILE'
      }
    };
    
    console.log(`   🔑 PK: USER#${normalizedEmail}`);
    console.log(`   🔑 SK: PROFILE`);
    
    const profileResult = await dynamodb.get(profileParams).promise();
    
    if (profileResult.Item) {
      console.log(`   ✅ PROFILE FOUND:`);
      console.log(`      Username: "${profileResult.Item.username}"`);
      console.log(`      Email: ${profileResult.Item.email || normalizedEmail}`);
      console.log(`      PK: ${profileResult.Item.PK || 'not set'}`);
      console.log(`      Visibility: ${profileResult.Item.usernameVisibility || 'public'}`);
      
      const usernameMatch = profileResult.Item.username && 
                         profileResult.Item.username.toLowerCase() === ownerUsername.toLowerCase();
      console.log(`      Username matches "${ownerUsername}": ${usernameMatch}`);
    } else {
      console.log(`   ❌ PROFILE NOT FOUND`);
      console.log(`   🔍 Trying alternative PK formats...`);
      
      // Try with UUID format
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      // Check if email might be stored differently
      console.log(`   ⚠️  PROFILE not found with email PK`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    console.error(error);
  }
  
  // Test 2: GSI lookup by username
  console.log(`\n📋 TEST 2: GSI lookup by username "${ownerUsername}"`);
  const ownerUsernameLower = ownerUsername.toLowerCase();
  
  for (const visibility of ['public', 'private']) {
    console.log(`\n   🔍 Checking ${visibility} visibility...`);
    
    // Try exact match
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
        console.log(`   ✅ GSI ${visibility} EXACT MATCH FOUND:`);
        console.log(`      Username: "${foundUser.username}"`);
        console.log(`      Email: ${foundUser.email || foundUser.PK?.replace('USER#', '') || 'not set'}`);
        console.log(`      PK: ${foundUser.PK || 'not set'}`);
        console.log(`      Match check: ${foundUser.username && foundUser.username.toLowerCase() === ownerUsernameLower}`);
      } else {
        console.log(`   ❌ GSI ${visibility} exact match: NOT FOUND`);
      }
    } catch (error) {
      if (error.code === 'ResourceNotFoundException') {
        console.log(`   ❌ GSI UsernameSearchIndex does not exist!`);
      } else {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
    }
  }
  
  // Test 3: Case variations
  console.log(`\n📋 TEST 3: GSI lookup with case variations`);
  const caseVariations = [
    ownerUsernameLower, // lowercase
    ownerUsernameLower.charAt(0).toUpperCase() + ownerUsernameLower.slice(1), // Capitalized
    ownerUsername.toUpperCase() // UPPERCASE
  ];
  
  for (const variation of caseVariations) {
    if (variation === ownerUsername) continue; // Already tried
    
    console.log(`\n   🔍 Trying variation: "${variation}"`);
    for (const visibility of ['public', 'private']) {
      const queryParams = {
        TableName: table,
        IndexName: 'UsernameSearchIndex',
        KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
        ExpressionAttributeValues: {
          ':visibility': visibility,
          ':username': variation
        },
        Limit: 1
      };
      
      try {
        const result = await dynamodb.query(queryParams).promise();
        if (result.Items && result.Items.length > 0) {
          const foundUser = result.Items[0];
          if (foundUser.username && foundUser.username.toLowerCase() === ownerUsernameLower) {
            console.log(`   ✅ GSI ${visibility} VARIATION MATCH: "${variation}"`);
            console.log(`      Username: "${foundUser.username}"`);
            console.log(`      Email: ${foundUser.email || foundUser.PK?.replace('USER#', '') || 'not set'}`);
            break;
          }
        }
      } catch (error) {
        // Skip errors
      }
    }
  }
  
  // Test 4: Scan for PROFILE items (last resort)
  console.log(`\n📋 TEST 4: PROFILE scan (checking first 10 items)`);
  try {
    const scanParams = {
      TableName: table,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':sk': 'PROFILE'
      },
      Limit: 10
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    console.log(`   📊 Scanned ${result.Items.length} PROFILE items`);
    
    const matchingItems = result.Items.filter(item => {
      if (!item.username) return false;
      return item.username.toLowerCase() === ownerUsernameLower ||
             item.PK?.replace('USER#', '').toLowerCase() === ownerEmail.toLowerCase();
    });
    
    if (matchingItems.length > 0) {
      console.log(`   ✅ FOUND ${matchingItems.length} matching PROFILE item(s):`);
      matchingItems.forEach((item, idx) => {
        console.log(`\n   [${idx + 1}] Match:`);
        console.log(`      PK: ${item.PK}`);
        console.log(`      Username: "${item.username}"`);
        console.log(`      Email: ${item.email || item.PK?.replace('USER#', '') || 'not set'}`);
        console.log(`      Visibility: ${item.usernameVisibility || 'public'}`);
      });
    } else {
      console.log(`   ❌ No matching PROFILE items found in first 10`);
      console.log(`   ⚠️  Note: This is a limited scan. Full scan would take longer.`);
    }
  } catch (error) {
    console.log(`   ❌ SCAN ERROR: ${error.message}`);
  }
  
  console.log(`\n✅ Test complete\n`);
}

testLookup().catch(console.error);
