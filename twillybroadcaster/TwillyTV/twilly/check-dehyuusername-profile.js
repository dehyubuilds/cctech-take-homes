const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkDehyuusernameProfile() {
  console.log('🔍 CHECKING DEHYUUSERNAME PROFILE\n');
  console.log('='.repeat(80));
  
  const username = 'dehyuusername';
  const uuidPK = 'USER#86326e3d-af6e-4b85-b4b9-38a5695342fc';
  
  // Check PROFILE with UUID PK
  console.log('\n1️⃣ CHECKING PROFILE WITH UUID PK:');
  console.log('-'.repeat(80));
  const uuidProfileParams = {
    TableName: table,
    Key: {
      PK: uuidPK,
      SK: 'PROFILE'
    }
  };
  
  const uuidProfileResult = await dynamodb.get(uuidProfileParams).promise();
  if (uuidProfileResult.Item) {
    console.log('PROFILE found with UUID PK:');
    console.log(JSON.stringify(uuidProfileResult.Item, null, 2));
    
    // Check if there's an email field
    if (uuidProfileResult.Item.email) {
      console.log(`\n✅ PROFILE has email field: ${uuidProfileResult.Item.email}`);
    } else {
      console.log(`\n⚠️ PROFILE does NOT have email field`);
    }
  } else {
    console.log('❌ No PROFILE found with UUID PK');
  }
  
  // Check GSI entry
  console.log('\n\n2️⃣ CHECKING GSI ENTRY:');
  console.log('-'.repeat(80));
  
  for (const visibility of ['public', 'private']) {
    const gsiParams = {
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
      ExpressionAttributeValues: {
        ':visibility': visibility,
        ':username': username
      },
      Limit: 10
    };
    
    try {
      const gsiResult = await dynamodb.query(gsiParams).promise();
      if (gsiResult.Items && gsiResult.Items.length > 0) {
        console.log(`\nFound ${gsiResult.Items.length} items in GSI with visibility=${visibility}:`);
        gsiResult.Items.forEach((item, idx) => {
          console.log(`\n   [${idx + 1}] Username: "${item.username}"`);
          console.log(`       PK: ${item.PK}`);
          console.log(`       SK: ${item.SK}`);
          console.log(`       Email field: ${item.email || 'MISSING'}`);
          console.log(`       Email from PK: ${item.PK?.replace('USER#', '') || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log(`Error querying GSI with visibility=${visibility}: ${error.message}`);
    }
  }
  
  // Scan all PROFILE entries to find dehyuusername
  console.log('\n\n3️⃣ SCANNING ALL PROFILES FOR DEHYUUSERNAME:');
  console.log('-'.repeat(80));
  
  const scanParams = {
    TableName: table,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: {
      ':sk': 'PROFILE'
    }
  };
  
  let allProfiles = [];
  let lastKey = null;
  
  do {
    if (lastKey) scanParams.ExclusiveStartKey = lastKey;
    const result = await dynamodb.scan(scanParams).promise();
    allProfiles = allProfiles.concat(result.Items || []);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  
  const dehyuProfiles = allProfiles.filter(p => 
    p.username && p.username.toLowerCase() === username.toLowerCase()
  );
  
  console.log(`Found ${dehyuProfiles.length} PROFILE entries for "${username}":`);
  dehyuProfiles.forEach((profile, idx) => {
    console.log(`\n   [${idx + 1}] PK: ${profile.PK}`);
    console.log(`       Username: "${profile.username}"`);
    console.log(`       Email field: ${profile.email || 'MISSING'}`);
    console.log(`       Email from PK: ${profile.PK?.replace('USER#', '') || 'N/A'}`);
  });
}

checkDehyuusernameProfile()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
