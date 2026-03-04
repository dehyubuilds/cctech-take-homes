const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const table = 'Twilly';
const BUCKET_NAME = 'theprivatecollection';

async function checkLatestStream() {
  console.log('🔍 Checking latest stream activity...\n');
  console.log('='.repeat(80));
  
  // Step 1: Find the most recent streamKey mapping created
  console.log('\n📋 STEP 1: Finding most recent streamKey mappings...\n');
  const recentStreamKeys = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':sk': 'MAPPING'
    }
  }).promise();
  
  if (!recentStreamKeys.Items || recentStreamKeys.Items.length === 0) {
    console.log('❌ No streamKey mappings found');
    return;
  }
  
  // Sort by createdAt (most recent first)
  const sortedKeys = recentStreamKeys.Items.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });
  
  const latestKey = sortedKeys[0];
  const streamKey = latestKey.streamKey || latestKey.PK.replace('STREAM_KEY#', '');
  
  console.log(`✅ Most recent streamKey: ${streamKey}`);
  console.log(`   Created: ${latestKey.createdAt || 'N/A'}`);
  console.log(`   Channel: ${latestKey.channelName || latestKey.seriesName || 'N/A'}`);
  console.log(`   Collaborator: ${latestKey.collaboratorEmail || 'N/A'}`);
  console.log(`   Owner: ${latestKey.ownerEmail || 'N/A'}`);
  console.log(`   isCollaboratorKey: ${latestKey.isCollaboratorKey || false}`);
  console.log(`   creatorId: ${latestKey.creatorId || 'N/A'}`);
  
  // Step 2: Check S3 for files with this streamKey
  console.log(`\n📋 STEP 2: Checking S3 for files with streamKey: ${streamKey}...\n`);
  try {
    const s3Files = await s3.listObjectsV2({
      Bucket: BUCKET_NAME,
      Prefix: `clips/${streamKey}/`,
      MaxKeys: 20
    }).promise();
    
    if (s3Files.Contents && s3Files.Contents.length > 0) {
      console.log(`✅ Found ${s3Files.Contents.length} file(s) in S3:`);
      
      // Group by uploadId or timestamp
      const masterPlaylists = s3Files.Contents.filter(f => f.Key.includes('_master.m3u8'));
      const thumbnails = s3Files.Contents.filter(f => f.Key.includes('_thumb.jpg'));
      
      console.log(`   Master playlists: ${masterPlaylists.length}`);
      console.log(`   Thumbnails: ${thumbnails.length}`);
      
      if (masterPlaylists.length > 0) {
        const latestPlaylist = masterPlaylists.sort((a, b) => 
          new Date(b.LastModified) - new Date(a.LastModified)
        )[0];
        console.log(`\n   Latest master playlist:`);
        console.log(`   ${latestPlaylist.Key}`);
        console.log(`   Modified: ${latestPlaylist.LastModified}`);
        console.log(`   Size: ${(latestPlaylist.Size / 1024).toFixed(2)} KB`);
      }
    } else {
      console.log(`⚠️ No files found in S3 for streamKey: ${streamKey}`);
      console.log(`   This means the stream hasn't been processed yet or upload failed`);
    }
  } catch (error) {
    console.log(`❌ Error checking S3: ${error.message}`);
  }
  
  // Step 3: Check DynamoDB for files with this streamKey
  console.log(`\n📋 STEP 3: Checking DynamoDB for files with streamKey: ${streamKey}...\n`);
  const dbFiles = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND streamKey = :streamKey',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':skPrefix': 'FILE#',
      ':streamKey': streamKey
    }
  }).promise();
  
  if (dbFiles.Items && dbFiles.Items.length > 0) {
    console.log(`✅ Found ${dbFiles.Items.length} file(s) in DynamoDB:`);
    
    // Sort by createdAt (most recent first)
    const sortedFiles = dbFiles.Items.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.timestamp || 0);
      const dateB = new Date(b.createdAt || b.timestamp || 0);
      return dateB - dateA;
    });
    
    sortedFiles.forEach((file, idx) => {
      console.log(`\n   [${idx + 1}] ${file.fileName || file.SK}`);
      console.log(`       Stored under: ${file.PK}`);
      console.log(`       folderName: ${file.folderName || 'N/A'}`);
      console.log(`       isVisible: ${file.isVisible}`);
      console.log(`       isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
      console.log(`       creatorId: ${file.creatorId || 'N/A'}`);
      console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
      console.log(`       hlsUrl: ${file.hlsUrl ? '✅' : '❌'}`);
      console.log(`       thumbnailUrl: ${file.thumbnailUrl ? '✅' : '❌'}`);
    });
  } else {
    console.log(`⚠️ No files found in DynamoDB for streamKey: ${streamKey}`);
    console.log(`   This means Lambda hasn't processed the S3 uploads yet`);
  }
  
  // Step 4: Check what get-content API would see
  console.log(`\n📋 STEP 4: Checking what get-content API would see...\n`);
  const masterEmail = 'dehyu.sinyan@gmail.com';
  const channelName = latestKey.channelName || latestKey.seriesName || 'Twilly TV';
  
  const contentQuery = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${masterEmail}`,
      ':skPrefix': 'FILE#'
    }
  }).promise();
  
  const visibleVideos = (contentQuery.Items || []).filter(file => {
    const fileChannelName = file.folderName || file.seriesName;
    const matchesChannel = fileChannelName === channelName;
    const isVisible = file.isVisible === true;
    const hasContent = file.fileName && !file.isFolder;
    const hasHls = file.hlsUrl;
    const hasStreamKey = file.streamKey;
    const hasThumbnail = file.thumbnailUrl && 
                         file.thumbnailUrl.trim() !== '' &&
                         file.thumbnailUrl !== 'null' &&
                         file.thumbnailUrl.startsWith('http');
    
    if (file.category === 'Videos') {
      if (!hasHls) return false;
      if (!hasStreamKey) return false;
      if (!hasThumbnail) return false;
    }
    
    return matchesChannel && isVisible && hasContent;
  });
  
  // Filter for this specific streamKey
  const streamKeyVideos = visibleVideos.filter(f => f.streamKey === streamKey);
  
  console.log(`   Querying: USER#${masterEmail}`);
  console.log(`   Channel: ${channelName}`);
  console.log(`   Total visible videos in channel: ${visibleVideos.length}`);
  console.log(`   Videos with this streamKey: ${streamKeyVideos.length}`);
  
  if (streamKeyVideos.length > 0) {
    console.log(`\n   ✅ Latest stream IS VISIBLE in channel:`);
    streamKeyVideos.forEach((file, idx) => {
      console.log(`   [${idx + 1}] ${file.fileName}`);
      console.log(`       isVisible: ${file.isVisible}`);
      console.log(`       createdAt: ${file.createdAt || 'N/A'}`);
    });
  } else {
    console.log(`\n   ⚠️ Latest stream is NOT VISIBLE in channel`);
    console.log(`   Possible reasons:`);
    console.log(`   1. isVisible is false (needs metadata posting)`);
    console.log(`   2. Missing hlsUrl or thumbnailUrl`);
    console.log(`   3. Lambda hasn't processed the files yet`);
  }
  
  // Summary
  console.log(`\n\n📊 SUMMARY:`);
  console.log(`   StreamKey: ${streamKey}`);
  const s3FileCount = s3Files?.Contents?.length || 0;
  console.log(`   S3 Files: ${s3FileCount}`);
  console.log(`   DynamoDB Files: ${dbFiles.Items?.length || 0}`);
  console.log(`   Visible in Channel: ${streamKeyVideos.length > 0 ? '✅ YES' : '❌ NO'}`);
  
  if (s3FileCount > 0 && dbFiles.Items?.length === 0) {
    console.log(`\n   ⚠️ ISSUE: Files exist in S3 but NOT in DynamoDB`);
    console.log(`   → Lambda may not have processed them yet, or Lambda failed`);
    console.log(`   → Check CloudWatch logs for Lambda execution`);
  } else if (s3Files?.Contents?.length === 0) {
    console.log(`\n   ⚠️ ISSUE: No files in S3`);
    console.log(`   → Streaming service may not have processed the stream yet`);
  } else if (dbFiles.Items?.length > 0 && streamKeyVideos.length === 0) {
    console.log(`\n   ⚠️ ISSUE: Files in DynamoDB but not visible`);
    console.log(`   → Check isVisible flag and required fields (hlsUrl, thumbnailUrl)`);
  } else if (streamKeyVideos.length > 0) {
    console.log(`\n   ✅ SUCCESS: Stream is visible in channel!`);
  }
}

checkLatestStream().catch(console.error);
