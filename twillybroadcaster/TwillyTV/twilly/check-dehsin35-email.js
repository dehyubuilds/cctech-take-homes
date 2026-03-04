const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkDehsin35Email() {
  console.log('🔍 Checking email jsinyan03@gmail.com for username "dehsin35"...\n');
  
  const email = 'jsinyan03@gmail.com';
  
  // Check PROFILE directly
  console.log(`1️⃣ Checking PROFILE for USER#${email}...`);
  try {
    const getParams = {
      TableName: table,
      Key: {
        PK: `USER#${email}`,
        SK: 'PROFILE'
      }
    };
    
    const result = await dynamodb.get(getParams).promise();
    if (result.Item) {
      console.log(`   ✅ PROFILE EXISTS:`);
      console.log(`   PK: ${result.Item.PK}`);
      console.log(`   SK: ${result.Item.SK}`);
      console.log(`   username: "${result.Item.username || 'MISSING'}"`);
      console.log(`   usernameVisibility: "${result.Item.usernameVisibility || 'MISSING'}"`);
      console.log(`   email: ${result.Item.email || email}`);
      
      // Check if it's in GSI
      if (result.Item.username && result.Item.usernameVisibility) {
        console.log(`\n2️⃣ Checking if this PROFILE is in GSI...`);
        const gsiParams = {
          TableName: table,
          IndexName: 'UsernameSearchIndex',
          KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
          ExpressionAttributeValues: {
            ':visibility': result.Item.usernameVisibility,
            ':username': result.Item.username
          },
          Limit: 1
        };
        
        const gsiResult = await dynamodb.query(gsiParams).promise();
        if (gsiResult.Items && gsiResult.Items.length > 0) {
          console.log(`   ✅ FOUND in GSI`);
        } else {
          console.log(`   ❌ NOT in GSI - THIS IS THE PROBLEM!`);
          console.log(`   The PROFILE exists but is not indexed in the GSI.`);
          console.log(`   Need to ensure username="${result.Item.username}" and usernameVisibility="${result.Item.usernameVisibility}" are set correctly.`);
        }
      } else {
        console.log(`\n   ⚠️ PROFILE missing username or usernameVisibility - cannot be in GSI`);
      }
    } else {
      console.log(`   ❌ PROFILE DOES NOT EXIST`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
  
  // Check all items for this email
  console.log(`\n3️⃣ Checking ALL items for USER#${email}...`);
  try {
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`
      },
      Limit: 20
    };
    
    const result = await dynamodb.query(queryParams).promise();
    if (result.Items && result.Items.length > 0) {
      console.log(`   ✅ Found ${result.Items.length} items:`);
      result.Items.forEach((item, idx) => {
        console.log(`\n   Item ${idx + 1}:`);
        console.log(`   SK: ${item.SK}`);
        if (item.username) console.log(`   username: "${item.username}"`);
        if (item.streamUsername) console.log(`   streamUsername: "${item.streamUsername}"`);
      });
    } else {
      console.log(`   ❌ NO ITEMS found for this email`);
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
  }
  
  console.log('\n✅ Check complete!');
}

checkDehsin35Email().catch(console.error);
