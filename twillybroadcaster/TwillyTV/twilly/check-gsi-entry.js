const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkGSIEntry() {
  console.log('🔍 CHECKING GSI ENTRY FOR "Twilly TV"\n');
  console.log('='.repeat(80));
  
  const targetEmail = 'dehyu.sinyan@gmail.com';
  const targetUsername = 'Twilly TV';
  
  // First, get the PROFILE to see what's stored
  console.log('\n1️⃣ PROFILE ENTRY:');
  console.log('-'.repeat(80));
  const profileParams = {
    TableName: table,
    Key: {
      PK: `USER#${targetEmail}`,
      SK: 'PROFILE'
    }
  };
  
  const profileResult = await dynamodb.get(profileParams).promise();
  if (profileResult.Item) {
    console.log('PROFILE data:');
    console.log(JSON.stringify(profileResult.Item, null, 2));
  } else {
    console.log('❌ PROFILE not found!');
    return;
  }
  
  // Check GSI with exact username
  console.log('\n\n2️⃣ CHECKING GSI WITH EXACT USERNAME:');
  console.log('-'.repeat(80));
  
  const usernameVariations = [
    'Twilly TV',
    'twilly tv',
    'Twilly tv',
    'TwillyTV',
    'twillytv'
  ];
  
  for (const variation of usernameVariations) {
    for (const visibility of ['public', 'private']) {
      console.log(`\n   Trying: "${variation}" with visibility: ${visibility}`);
      const gsiParams = {
        TableName: table,
        IndexName: 'UsernameSearchIndex',
        KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
        ExpressionAttributeValues: {
          ':visibility': visibility,
          ':username': variation
        },
        Limit: 10
      };
      
      try {
        const gsiResult = await dynamodb.query(gsiParams).promise();
        console.log(`   ✅ Query succeeded - found ${gsiResult.Items.length} items`);
        if (gsiResult.Items.length > 0) {
          gsiResult.Items.forEach((item, idx) => {
            console.log(`      [${idx + 1}] Username: "${item.username}", Email: ${item.email || 'N/A'}`);
            console.log(`          PK: ${item.PK || 'N/A'}, SK: ${item.SK || 'N/A'}`);
          });
        }
      } catch (error) {
        console.log(`   ❌ Query failed: ${error.message}`);
      }
    }
  }
  
  // Scan the entire GSI for private visibility
  console.log('\n\n3️⃣ SCANNING GSI FOR PRIVATE VISIBILITY:');
  console.log('-'.repeat(80));
  
  const scanParams = {
    TableName: table,
    IndexName: 'UsernameSearchIndex',
    KeyConditionExpression: 'usernameVisibility = :visibility',
    ExpressionAttributeValues: {
      ':visibility': 'private'
    },
    Limit: 100
  };
  
  let lastKey = null;
  let foundTwillyTV = false;
  
  do {
    if (lastKey) scanParams.ExclusiveStartKey = lastKey;
    try {
      const scanResult = await dynamodb.query(scanParams).promise();
      console.log(`   Scanned ${scanResult.Items.length} items...`);
      
      const twillyTVItem = scanResult.Items.find(item => {
        if (!item.username) return false;
        const normalized = item.username.replace(/\s+/g, '').toLowerCase();
        return normalized === 'twillytv';
      });
      
      if (twillyTVItem) {
        foundTwillyTV = true;
        console.log('\n   ✅ FOUND "Twilly TV" in GSI:');
        console.log(JSON.stringify(twillyTVItem, null, 2));
      }
      
      lastKey = scanResult.LastEvaluatedKey;
    } catch (error) {
      console.log(`   ❌ Scan error: ${error.message}`);
      break;
    }
  } while (lastKey && !foundTwillyTV);
  
  if (!foundTwillyTV) {
    console.log('\n   ⚠️ "Twilly TV" NOT FOUND in GSI!');
    console.log('   This explains why the lookup fails!');
    console.log('   The PROFILE exists but the GSI entry might be missing or incorrect.');
  }
}

checkGSIEntry()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
