const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function inspectAllEntries() {
  const userEmail = 'dehyubuilds@gmail.com';
  const normalizedEmail = userEmail.toLowerCase();
  const username = 'dehyuusername';
  
  console.log(`\n🔍 Inspecting ALL entries for: ${normalizedEmail} (username: ${username})\n`);
  
  try {
    // 1. Check all ADDED_USERNAME entries (both public and private)
    console.log('1️⃣ Checking ADDED_USERNAME entries...\n');
    const addedParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${normalizedEmail}`,
        ':skPrefix': 'ADDED_USERNAME#'
      }
    };
    const addedResult = await dynamodb.query(addedParams).promise();
    const addedItems = addedResult.Items || [];
    console.log(`   Found ${addedItems.length} ADDED_USERNAME entries:`);
    addedItems.forEach((item, idx) => {
      console.log(`   [${idx + 1}] SK: ${item.SK}`);
      console.log(`       streamerUsername: "${item.streamerUsername || 'MISSING'}"`);
      console.log(`       streamerEmail: "${item.streamerEmail || 'MISSING'}"`);
      console.log(`       streamerVisibility: "${item.streamerVisibility || 'public'}"`);
      console.log(`       status: "${item.status || 'MISSING'}"`);
      const sk = item.SK || '';
      if (sk.includes('#private')) {
        console.log(`       ⚠️  PRIVATE ENTRY (SK contains #private)`);
      }
      if ((item.streamerVisibility || 'public').toLowerCase() === 'private') {
        console.log(`       ⚠️  PRIVATE ENTRY (streamerVisibility = private)`);
      }
      console.log('');
    });
    
    // 2. Check FOLLOW_REQUEST entries
    console.log('2️⃣ Checking FOLLOW_REQUEST entries...\n');
    const followParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${normalizedEmail}`,
        ':skPrefix': 'FOLLOW_REQUEST#'
      }
    };
    const followResult = await dynamodb.query(followParams).promise();
    const followItems = followResult.Items || [];
    console.log(`   Found ${followItems.length} FOLLOW_REQUEST entries:`);
    followItems.forEach((item, idx) => {
      console.log(`   [${idx + 1}] SK: ${item.SK}`);
      console.log(`       requestedUsername: "${item.requestedUsername || 'MISSING'}"`);
      console.log(`       requestedUserEmail: "${item.requestedUserEmail || 'MISSING'}"`);
      console.log(`       status: "${item.status || 'MISSING'}"`);
      console.log('');
    });
    
    // 3. Check PROFILE entry
    console.log('3️⃣ Checking PROFILE entry...\n');
    const profileParams = {
      TableName: table,
      Key: {
        PK: `USER#${normalizedEmail}`,
        SK: 'PROFILE'
      }
    };
    const profileResult = await dynamodb.get(profileParams).promise();
    if (profileResult.Item) {
      console.log(`   PROFILE found:`);
      console.log(`       username: "${profileResult.Item.username || 'MISSING'}"`);
      console.log(`       usernameVisibility: "${profileResult.Item.usernameVisibility || 'MISSING'}"`);
      console.log(`       streamerVisibility: "${profileResult.Item.streamerVisibility || 'MISSING'}"`);
    } else {
      console.log(`   ❌ No PROFILE found`);
    }
    console.log('');
    
    // 4. Check if dehyuusername has any entries where they are the streamer
    console.log('4️⃣ Checking entries where dehyuusername is the STREAMER (owner)...\n');
    
    // First, find dehyuusername's email
    const usernameSearchParams = {
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': username.toLowerCase()
      }
    };
    
    try {
      const usernameResult = await dynamodb.query(usernameSearchParams).promise();
      const usernameItems = usernameResult.Items || [];
      console.log(`   Found ${usernameItems.length} entries for username "${username}":`);
      usernameItems.forEach((item, idx) => {
        console.log(`   [${idx + 1}] PK: ${item.PK}`);
        console.log(`       SK: ${item.SK}`);
        console.log(`       username: "${item.username || 'MISSING'}"`);
        console.log(`       email: "${item.email || 'MISSING'}"`);
        if (item.PK && item.PK.startsWith('USER#')) {
          const ownerEmail = item.PK.replace('USER#', '');
          console.log(`       ⚠️  This user's email: ${ownerEmail}`);
          
          // Check if dehyubuilds@gmail.com has added this user
          const checkParams = {
            TableName: table,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
            ExpressionAttributeValues: {
              ':pk': `USER#${normalizedEmail}`,
              ':skPrefix': `ADDED_USERNAME#${ownerEmail.toLowerCase()}`
            }
          };
          dynamodb.query(checkParams).promise().then(result => {
            if (result.Items && result.Items.length > 0) {
              console.log(`       🔍 Found ${result.Items.length} ADDED_USERNAME entry(ies) for this user:`);
              result.Items.forEach(entry => {
                console.log(`          SK: ${entry.SK}`);
                console.log(`          streamerUsername: "${entry.streamerUsername || 'MISSING'}"`);
                console.log(`          streamerVisibility: "${entry.streamerVisibility || 'public'}"`);
              });
            }
          }).catch(err => console.log(`       Error checking: ${err.message}`));
        }
        console.log('');
      });
    } catch (error) {
      console.log(`   ⚠️  Could not query GSI: ${error.message}`);
    }
    
    // 5. Check for Twilly TV specifically
    console.log('5️⃣ Checking for Twilly TV entries...\n');
    const twillyTVEmail = 'dehyu.sinyan@gmail.com';
    const twillyCheckParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${normalizedEmail}`,
        ':skPrefix': `ADDED_USERNAME#${twillyTVEmail.toLowerCase()}`
      }
    };
    const twillyResult = await dynamodb.query(twillyCheckParams).promise();
    const twillyItems = twillyResult.Items || [];
    console.log(`   Found ${twillyItems.length} entries for Twilly TV (${twillyTVEmail}):`);
    twillyItems.forEach((item, idx) => {
      console.log(`   [${idx + 1}] SK: ${item.SK}`);
      console.log(`       streamerUsername: "${item.streamerUsername || 'MISSING'}"`);
      console.log(`       streamerVisibility: "${item.streamerVisibility || 'public'}"`);
      console.log(`       status: "${item.status || 'MISSING'}"`);
      const sk = item.SK || '';
      if (sk.includes('#private')) {
        console.log(`       🚫 PRIVATE ENTRY (SK contains #private) - should NOT appear in public list!`);
      }
      if ((item.streamerVisibility || 'public').toLowerCase() === 'private') {
        console.log(`       🚫 PRIVATE ENTRY (streamerVisibility = private) - should NOT appear in public list!`);
      }
      console.log('');
    });
    
    console.log('\n✅ Inspection complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

inspectAllEntries();
