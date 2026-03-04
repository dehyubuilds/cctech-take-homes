const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function verifyTestVideo() {
  console.log('🔍 Verifying test video setup...\n');

  const channelName = 'Twilly After Dark';
  const testUsername = 'googoogaga';
  const testEmail = 'dehsin365@gmail.com';
  const userId = 'f6ff9d4d-fb19-425c-94cb-617a9ee6f7fc';

  // 1. Check user profile
  console.log('1️⃣ Checking user profile...');
  try {
    const profile = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE'
      }
    }).promise();
    
    if (profile.Item) {
      console.log(`   ✅ User profile found`);
      console.log(`   Username: ${profile.Item.username || profile.Item.userName || 'N/A'}`);
      console.log(`   Email: ${profile.Item.email || profile.Item.userEmail || 'N/A'}\n`);
    } else {
      console.log(`   ❌ User profile not found\n`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // 2. Check collaborator role
  console.log('2️⃣ Checking collaborator role...');
  try {
    const role = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: `COLLABORATOR_ROLE#${channelName}`
      }
    }).promise();
    
    if (role.Item) {
      console.log(`   ✅ Collaborator role found`);
      console.log(`   Channel: ${role.Item.channelName || 'N/A'}`);
      console.log(`   addedViaInvite: ${role.Item.addedViaInvite}\n`);
    } else {
      console.log(`   ❌ Collaborator role not found\n`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // 3. Check video file
  console.log('3️⃣ Checking video file...');
  try {
    const fileQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'folderName = :channelName OR seriesName = :channelName',
      ExpressionAttributeValues: {
        ':pk': `USER#${testEmail}`,
        ':skPrefix': 'FILE#',
        ':channelName': channelName
      }
    }).promise();
    
    if (fileQuery.Items && fileQuery.Items.length > 0) {
      console.log(`   ✅ Found ${fileQuery.Items.length} video(s) in channel`);
      fileQuery.Items.forEach((item, idx) => {
        console.log(`   [${idx + 1}] ${item.fileName || 'N/A'}`);
        console.log(`       StreamKey: ${item.streamKey || 'N/A'}`);
        console.log(`       isVisible: ${item.isVisible}`);
        console.log(`       hasHls: ${!!item.hlsUrl}\n`);
      });
    } else {
      console.log(`   ❌ No videos found in channel\n`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // 4. Check streamKey mapping
  console.log('4️⃣ Checking streamKey mappings...');
  try {
    const streamKeyScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND channelName = :channelName',
      ExpressionAttributeValues: {
        ':pkPrefix': 'STREAM_KEY#',
        ':sk': 'MAPPING',
        ':channelName': channelName
      }
    }).promise();
    
    if (streamKeyScan.Items && streamKeyScan.Items.length > 0) {
      console.log(`   ✅ Found ${streamKeyScan.Items.length} streamKey mapping(s)`);
      streamKeyScan.Items.forEach((item, idx) => {
        console.log(`   [${idx + 1}] StreamKey: ${item.streamKey || 'N/A'}`);
        console.log(`       collaboratorEmail: ${item.collaboratorEmail || 'N/A'}`);
        console.log(`       ownerEmail: ${item.ownerEmail || 'N/A'}`);
        console.log(`       creatorId: ${item.creatorId || 'N/A'}`);
        console.log(`       isCollaboratorKey: ${item.isCollaboratorKey}\n`);
      });
    } else {
      console.log(`   ❌ No streamKey mappings found\n`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  console.log('✅ Verification complete!');
  console.log('\n📱 To test in mobile app:');
  console.log(`   1. Open the "${channelName}" channel`);
  console.log(`   2. Look for a video with username "${testUsername}"`);
  console.log(`   3. The video should appear in the channel list`);
}

verifyTestVideo().catch(console.error);
