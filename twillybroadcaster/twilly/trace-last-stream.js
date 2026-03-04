// Trace the last stream through every step
const AWS = require('aws-sdk');

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function traceLastStream() {
  console.log('='.repeat(80));
  console.log('🔍 TRACING LAST STREAM - COMPLETE FLOW ANALYSIS');
  console.log('='.repeat(80));
  console.log('');
  
  // Step 1: Get most recent video
  console.log('📋 STEP 1: Getting most recent video entry...');
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
  const createdAt = video.createdAt || video.timestamp;
  const videoIsPrivate = video.isPrivateUsername;
  
  console.log(`✅ Found video:`);
  console.log(`   FileId: ${fileId}`);
  console.log(`   StreamKey: ${streamKey}`);
  console.log(`   Created: ${createdAt}`);
  console.log(`   isPrivateUsername: ${JSON.stringify(videoIsPrivate)} (type: ${typeof videoIsPrivate})`);
  console.log('');
  
  // Step 2: Check streamKey mapping
  console.log('📋 STEP 2: Checking streamKey mapping...');
  const mappingQuery = await dynamodb.get({
    TableName: 'Twilly',
    Key: {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING'
    },
    ConsistentRead: true
  }).promise();
  
  if (!mappingQuery.Item) {
    console.log('❌ STREAMKEY MAPPING NOT FOUND!');
    console.log('   This is a CRITICAL ERROR - mapping should exist!');
    console.log('');
  } else {
    const mapping = mappingQuery.Item;
    const mappingIsPrivate = mapping.isPrivateUsername;
    const mappingUpdated = mapping.updatedAt || mapping.createdAt;
    
    console.log(`✅ Mapping found:`);
    console.log(`   Updated: ${mappingUpdated}`);
    console.log(`   isPrivateUsername: ${JSON.stringify(mappingIsPrivate)} (type: ${typeof mappingIsPrivate})`);
    console.log('');
    
    // Step 3: Compare values
    console.log('📋 STEP 3: Comparing values...');
    const videoIsPrivateBool = videoIsPrivate === true || videoIsPrivate === 'true' || videoIsPrivate === 1;
    const mappingIsPrivateBool = mappingIsPrivate === true || mappingIsPrivate === 'true' || mappingIsPrivate === 1;
    
    console.log(`   Video isPrivateUsername: ${videoIsPrivateBool} (${JSON.stringify(videoIsPrivate)})`);
    console.log(`   Mapping isPrivateUsername: ${mappingIsPrivateBool} (${JSON.stringify(mappingIsPrivate)})`);
    console.log('');
    
    if (mappingIsPrivateBool && !videoIsPrivateBool) {
      console.log('❌ BREAKPOINT FOUND #1: Mapping says PRIVATE but video says PUBLIC!');
      console.log('   This means createVideoEntryImmediately did NOT correctly read the value!');
      console.log('');
    } else if (videoIsPrivate === undefined || videoIsPrivate === null) {
      console.log('❌ BREAKPOINT FOUND #2: Video has NO isPrivateUsername field!');
      console.log('   This means createVideoEntryImmediately did NOT set the field!');
      console.log('');
    } else if (videoIsPrivateBool && mappingIsPrivateBool) {
      console.log('✅ Both values match - video is correctly marked as PRIVATE');
      console.log('   But user says it went to PUBLIC - checking filtering logic...');
      console.log('');
    } else {
      console.log('⚠️  Both values match - video is PUBLIC (as expected)');
      console.log('');
    }
  }
  
  // Step 4: Check timing
  console.log('📋 STEP 4: Checking timing...');
  if (mappingQuery.Item) {
    const mappingUpdated = mappingQuery.Item.updatedAt || mappingQuery.Item.createdAt;
    if (mappingUpdated && createdAt) {
      const mappingTime = new Date(mappingUpdated).getTime();
      const videoTime = new Date(createdAt).getTime();
      const diff = videoTime - mappingTime;
      
      console.log(`   Mapping updated: ${mappingUpdated} (${mappingTime})`);
      console.log(`   Video created: ${createdAt} (${videoTime})`);
      console.log(`   Time difference: ${diff}ms`);
      
      if (diff < 0) {
        console.log('   ⚠️  Video was created BEFORE mapping was updated!');
        console.log('   This could cause a race condition!');
      } else if (diff < 1000) {
        console.log('   ⚠️  Video was created within 1 second of mapping update');
        console.log('   Possible race condition!');
      } else {
        console.log('   ✅ Video was created after mapping was updated');
      }
      console.log('');
    }
  }
  
  // Step 5: Check if Lambda overwrote it
  console.log('📋 STEP 5: Checking if Lambda might have overwritten...');
  console.log('   Lambda uses UpdateItemCommand which should preserve isPrivateUsername');
  console.log('   But if Lambda ran BEFORE createVideoEntryImmediately, it might not have the value');
  console.log('   Check Lambda logs for this fileId:', fileId);
  console.log('');
  
  // Step 6: Summary
  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`StreamKey: ${streamKey}`);
  console.log(`FileId: ${fileId}`);
  console.log(`Video isPrivateUsername: ${JSON.stringify(videoIsPrivate)}`);
  if (mappingQuery.Item) {
    console.log(`Mapping isPrivateUsername: ${JSON.stringify(mappingQuery.Item.isPrivateUsername)}`);
  } else {
    console.log(`Mapping: NOT FOUND`);
  }
  console.log('');
  console.log('🔍 Next steps:');
  console.log('1. Check EC2 logs for this streamKey:', streamKey);
  console.log('2. Check if createVideoEntryImmediately was called');
  console.log('3. Check if global map was set');
  console.log('4. Check Lambda logs for this fileId:', fileId);
  console.log('');
}

traceLastStream().catch(console.error);
