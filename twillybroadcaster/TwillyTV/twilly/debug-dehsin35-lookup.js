import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugDehsin35Lookup() {
  const username = 'dehsin35';
  const email = 'jsinyan03@gmail.com';
  const usernameLower = username.toLowerCase();
  
  console.log(`🔍 Debugging lookup for username: "${username}" (email: ${email})\n`);
  
  // 1. Check GSI by username
  console.log('1️⃣ Checking GSI UsernameSearchIndex...');
  for (const visibility of ['public', 'private']) {
    const queryParams = {
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility',
      ExpressionAttributeValues: {
        ':visibility': visibility
      },
      Limit: 100
    };
    
    let lastEvaluatedKey = null;
    let found = false;
    
    do {
      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamodb.query(queryParams).promise();
      const items = result.Items || [];
      
      for (const item of items) {
        if (!item.username) continue;
        const itemUsernameClean = item.username.replace(/🔒/g, '').trim().toLowerCase();
        if (itemUsernameClean === usernameLower) {
          console.log(`   ✅ Found in GSI (${visibility}):`);
          console.log(`      Username: "${item.username}"`);
          console.log(`      Email: ${item.PK?.replace('USER#', '') || item.email || 'MISSING'}`);
          console.log(`      PK: ${item.PK || 'MISSING'}`);
          console.log(`      SK: ${item.SK || 'MISSING'}`);
          found = true;
          break;
        }
      }
      
      if (found) break;
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    if (found) break;
  }
  
  // 2. Check by email directly
  console.log('\n2️⃣ Checking PROFILE by email...');
  const profileParams = {
    TableName: table,
    Key: {
      PK: `USER#${email.toLowerCase()}`,
      SK: 'PROFILE'
    }
  };
  
  const profileResult = await dynamodb.get(profileParams).promise();
  if (profileResult.Item) {
    console.log(`   ✅ Found PROFILE by email:`);
    console.log(`      Username: "${profileResult.Item.username || 'MISSING'}"`);
    console.log(`      Email: ${email}`);
    console.log(`      PK: USER#${email.toLowerCase()}`);
  } else {
    console.log(`   ❌ No PROFILE found for email: ${email}`);
  }
  
  // 3. Check STREAM_KEY#MAPPING
  console.log('\n3️⃣ Checking STREAM_KEY#MAPPING...');
  let lastEvaluatedKey = null;
  let foundInMapping = false;
  
  do {
    const scanParams = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'STREAM_KEY#',
        ':sk': 'MAPPING'
      },
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 100
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    
    for (const mapping of items) {
      if (!mapping.streamUsername) continue;
      const baseUsername = mapping.streamUsername.replace(/🔒/g, '').trim().toLowerCase();
      if (baseUsername === usernameLower) {
        console.log(`   ✅ Found in STREAM_KEY#MAPPING:`);
        console.log(`      streamUsername: "${mapping.streamUsername}"`);
        console.log(`      userEmail: ${mapping.userEmail || mapping.email || mapping.collaboratorEmail || mapping.ownerEmail || 'MISSING'}`);
        foundInMapping = true;
        break;
      }
    }
    
    if (foundInMapping) break;
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  if (!foundInMapping) {
    console.log(`   ❌ Not found in STREAM_KEY#MAPPING`);
  }
  
  // 4. Try exact match queries with variations
  console.log('\n4️⃣ Trying exact GSI queries with case variations...');
  const variations = [
    username,
    usernameLower,
    username.charAt(0).toUpperCase() + usernameLower.slice(1),
    username.toUpperCase()
  ];
  
  for (const variation of variations) {
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
      
      const result = await dynamodb.query(queryParams).promise();
      if (result.Items && result.Items.length > 0) {
        const foundUser = result.Items[0];
        const foundUsernameClean = foundUser.username?.replace(/🔒/g, '').trim().toLowerCase();
        if (foundUsernameClean === usernameLower) {
          console.log(`   ✅ Found with exact match (${visibility}): "${variation}"`);
          console.log(`      Stored username: "${foundUser.username}"`);
          console.log(`      Email: ${foundUser.PK?.replace('USER#', '') || foundUser.email || 'MISSING'}`);
          break;
        }
      }
    }
  }
  
  console.log('\n✅ Debug complete!');
}

debugDehsin35Lookup()
  .then(() => {
    console.log('\n✅ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
