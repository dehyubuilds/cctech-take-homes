const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkDehyuusernamePremium() {
  console.log('🔍 Checking last stream from dehyuusername for premium flag...\n');
  console.log('='.repeat(80));
  
  // Step 1: Find dehyuusername profile to get email
  console.log('\n📋 STEP 1: Finding dehyuusername profile...\n');
  const profileScan = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND (username = :username OR #username = :username)',
    ExpressionAttributeNames: {
      '#username': 'username'
    },
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':sk': 'PROFILE',
      ':username': 'dehyuusername'
    }
  }).promise();
  
  if (!profileScan.Items || profileScan.Items.length === 0) {
    console.log('❌ No profile found for username: dehyuusername');
    return;
  }
  
  const profile = profileScan.Items[0];
  const userEmail = profile.PK.replace('USER#', '');
  console.log(`✅ Found profile:`);
  console.log(`   Email: ${userEmail}`);
  console.log(`   Username: ${profile.username || 'N/A'}`);
  
  // Step 2: Find recent streams from this user
  console.log(`\n📋 STEP 2: Finding recent streams from ${userEmail}...\n`);
  const filesResult = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userEmail}`,
      ':sk': 'FILE#'
    },
    Limit: 5,
    ScanIndexForward: false
  }).promise();
  
  if (!filesResult.Items || filesResult.Items.length === 0) {
    console.log('❌ No streams found');
    return;
  }
  
  console.log(`✅ Found ${filesResult.Items.length} recent stream(s)\n`);
  
  // Step 3: Check the most recent stream
  const latestStream = filesResult.Items[0];
  console.log('📹 LATEST STREAM:');
  console.log(`   SK: ${latestStream.SK}`);
  console.log(`   FileName: ${latestStream.fileName || 'N/A'}`);
  console.log(`   StreamKey: ${latestStream.streamKey || 'N/A'}`);
  console.log(`   CreatorUsername: ${latestStream.creatorUsername || 'N/A'}`);
  console.log(`   isPrivateUsername: ${latestStream.isPrivateUsername} (type: ${typeof latestStream.isPrivateUsername})`);
  console.log(`   isPremium: ${latestStream.isPremium} (type: ${typeof latestStream.isPremium})`);
  console.log(`   CreatedAt: ${latestStream.createdAt || latestStream.timestamp || 'N/A'}`);
  
  // Step 4: Check stream key mapping
  if (latestStream.streamKey) {
    console.log(`\n📋 STEP 3: Checking stream key mapping for ${latestStream.streamKey}...\n`);
    const streamKeyParams = {
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${latestStream.streamKey}`,
        SK: 'MAPPING'
      }
    };
    
    const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
    
    if (streamKeyResult.Item) {
      console.log('✅ Stream key mapping found:');
      console.log(`   streamUsername: ${streamKeyResult.Item.streamUsername || 'N/A'}`);
      console.log(`   isPrivateUsername: ${streamKeyResult.Item.isPrivateUsername} (type: ${typeof streamKeyResult.Item.isPrivateUsername})`);
      console.log(`   isPremium: ${streamKeyResult.Item.isPremium} (type: ${typeof streamKeyResult.Item.isPremium})`);
      console.log(`   createdAt: ${streamKeyResult.Item.createdAt || 'N/A'}`);
      console.log(`   updatedAt: ${streamKeyResult.Item.updatedAt || 'N/A'}`);
    } else {
      console.log('❌ No stream key mapping found');
    }
  }
  
  // Step 5: Check all recent streams
  console.log(`\n📋 STEP 4: Checking all recent streams...\n`);
  filesResult.Items.forEach((item, index) => {
    console.log(`\n📹 Stream #${index + 1}:`);
    console.log(`   FileName: ${item.fileName || 'N/A'}`);
    console.log(`   StreamKey: ${item.streamKey || 'N/A'}`);
    console.log(`   isPrivateUsername: ${item.isPrivateUsername} (type: ${typeof item.isPrivateUsername})`);
    console.log(`   isPremium: ${item.isPremium} (type: ${typeof item.isPremium})`);
    console.log(`   CreatedAt: ${item.createdAt || item.timestamp || 'N/A'}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Check complete');
}

checkDehyuusernamePremium().catch(console.error);
