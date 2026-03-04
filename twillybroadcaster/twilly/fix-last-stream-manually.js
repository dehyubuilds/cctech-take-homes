// Manually fix the last stream by updating isPrivateUsername
const AWS = require('aws-sdk');

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function fixLastStream() {
  console.log('='.repeat(80));
  console.log('🔧 MANUALLY FIXING LAST STREAM');
  console.log('='.repeat(80));
  console.log('');
  
  // Step 1: Get last video
  console.log('📋 Step 1: Getting last video...');
  const videoQuery = await dynamodb.query({
    TableName: 'Twilly',
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': 'USER#dehyu.sinyan@gmail.com',
      ':sk': 'FILE#'
    },
    ScanIndexForward: false,
    Limit: 1
  }).promise();
  
  if (!videoQuery.Items || videoQuery.Items.length === 0) {
    console.log('❌ No videos found!');
    return;
  }
  
  const video = videoQuery.Items[0];
  const streamKey = video.streamKey;
  const fileId = video.SK.replace('FILE#', '');
  
  console.log(`✅ Found video:`);
  console.log(`   FileId: ${fileId}`);
  console.log(`   StreamKey: ${streamKey}`);
  console.log(`   Current isPrivateUsername: ${JSON.stringify(video.isPrivateUsername)}`);
  console.log('');
  
  // Step 2: Get streamKey mapping
  console.log('📋 Step 2: Getting streamKey mapping...');
  const mappingQuery = await dynamodb.get({
    TableName: 'Twilly',
    Key: {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING'
    },
    ConsistentRead: true
  }).promise();
  
  if (!mappingQuery.Item) {
    console.log('❌ CRITICAL: streamKey mapping NOT FOUND!');
    console.log(`   PK: STREAM_KEY#${streamKey}`);
    console.log(`   SK: MAPPING`);
    console.log('');
    console.log('   This is why createVideoEntryImmediately failed!');
    console.log('   The mapping must exist for RTMP streams to work.');
    return;
  }
  
  const mapping = mappingQuery.Item;
  const mappingIsPrivate = mapping.isPrivateUsername === true || 
                           mapping.isPrivateUsername === 'true' || 
                           mapping.isPrivateUsername === 1;
  
  console.log(`✅ Mapping found:`);
  console.log(`   OwnerEmail: ${mapping.ownerEmail || 'N/A'}`);
  console.log(`   CollaboratorEmail: ${mapping.collaboratorEmail || 'N/A'}`);
  console.log(`   ChannelName: ${mapping.channelName || mapping.seriesName || 'N/A'}`);
  console.log(`   isPrivateUsername: ${mappingIsPrivate}`);
  console.log('');
  
  // Step 3: Update video with correct isPrivateUsername
  console.log('📋 Step 3: Updating video with correct isPrivateUsername...');
  
  const currentVideoIsPrivate = video.isPrivateUsername === true || 
                                video.isPrivateUsername === 'true' || 
                                video.isPrivateUsername === 1;
  
  if (currentVideoIsPrivate === mappingIsPrivate) {
    console.log(`✅ Video already has correct isPrivateUsername: ${mappingIsPrivate}`);
    console.log('   No update needed.');
    return;
  }
  
  console.log(`   Updating from ${currentVideoIsPrivate} to ${mappingIsPrivate}...`);
  
  await dynamodb.update({
    TableName: 'Twilly',
    Key: {
      PK: video.PK,
      SK: video.SK
    },
    UpdateExpression: 'SET isPrivateUsername = :isPrivate',
    ExpressionAttributeValues: {
      ':isPrivate': mappingIsPrivate
    }
  }).promise();
  
  console.log(`✅ Video updated!`);
  console.log(`   isPrivateUsername: ${mappingIsPrivate}`);
  console.log('');
  
  // Step 4: Verify
  console.log('📋 Step 4: Verifying update...');
  const verifyQuery = await dynamodb.get({
    TableName: 'Twilly',
    Key: {
      PK: video.PK,
      SK: video.SK
    }
  }).promise();
  
  const verifiedIsPrivate = verifyQuery.Item.isPrivateUsername === true || 
                           verifyQuery.Item.isPrivateUsername === 'true' || 
                           verifyQuery.Item.isPrivateUsername === 1;
  
  console.log(`✅ Verification:`);
  console.log(`   Video isPrivateUsername: ${verifiedIsPrivate}`);
  console.log(`   Mapping isPrivateUsername: ${mappingIsPrivate}`);
  console.log(`   Match: ${verifiedIsPrivate === mappingIsPrivate ? '✅ YES' : '❌ NO'}`);
  console.log('');
  
  console.log('='.repeat(80));
  console.log('✅ FIX COMPLETE');
  console.log('='.repeat(80));
}

fixLastStream().catch(console.error);
