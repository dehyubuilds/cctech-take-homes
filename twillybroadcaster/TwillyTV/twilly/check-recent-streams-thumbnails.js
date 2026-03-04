const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({ region: 'us-east-2' }); // Bucket is in us-east-2
const table = 'Twilly';
const BUCKET_NAME = 'theprivatecollection';

async function checkRecentStreams() {
  console.log('🔍 Checking recent streams (last 2 hours)...\n');
  console.log('='.repeat(80));
  
  // Step 1: Find recent streamKey mappings (last 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  
  console.log('\n📋 STEP 1: Finding recent streamKey mappings...\n');
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
  
  // Filter and sort by createdAt (most recent first)
  const recentKeys = recentStreamKeys.Items
    .filter(key => {
      const createdAt = new Date(key.createdAt || 0);
      return createdAt >= twoHoursAgo;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });
  
  if (recentKeys.length === 0) {
    console.log('⚠️ No streamKey mappings found in the last 2 hours');
    return;
  }
  
  console.log(`✅ Found ${recentKeys.length} recent streamKey(s)\n`);
  
  // Check each recent stream
  for (let i = 0; i < recentKeys.length; i++) {
    const keyMapping = recentKeys[i];
    const streamKey = keyMapping.streamKey || keyMapping.PK.replace('STREAM_KEY#', '');
    const channelName = keyMapping.channelName || keyMapping.seriesName || 'Twilly TV';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${i + 1}/${recentKeys.length}] StreamKey: ${streamKey}`);
    console.log(`Channel: ${channelName}`);
    console.log(`Created: ${keyMapping.createdAt || 'N/A'}`);
    console.log(`User: ${keyMapping.collaboratorEmail || keyMapping.ownerEmail || 'N/A'}`);
    
    // Check S3 files
    console.log(`\n📦 Checking S3 files...`);
    try {
      const s3Files = await s3.listObjectsV2({
        Bucket: BUCKET_NAME,
        Prefix: `clips/${streamKey}/`,
        MaxKeys: 50
      }).promise();
      
      if (s3Files.Contents && s3Files.Contents.length > 0) {
        console.log(`   ✅ Found ${s3Files.Contents.length} file(s) in S3`);
        
        const masterPlaylists = s3Files.Contents.filter(f => f.Key.includes('_master.m3u8'));
        const thumbnails = s3Files.Contents.filter(f => f.Key.includes('_thumb.jpg'));
        const segments = s3Files.Contents.filter(f => f.Key.includes('.ts'));
        
        console.log(`   Master playlists: ${masterPlaylists.length}`);
        console.log(`   Thumbnails: ${thumbnails.length}`);
        console.log(`   Video segments: ${segments.length}`);
        
        if (masterPlaylists.length > 0) {
          const latest = masterPlaylists.sort((a, b) => 
            new Date(b.LastModified) - new Date(a.LastModified)
          )[0];
          console.log(`   Latest playlist: ${latest.Key}`);
          console.log(`   Modified: ${latest.LastModified}`);
        }
        
        if (thumbnails.length > 0) {
          const latestThumb = thumbnails.sort((a, b) => 
            new Date(b.LastModified) - new Date(a.LastModified)
          )[0];
          console.log(`   Latest thumbnail: ${latestThumb.Key}`);
          console.log(`   Modified: ${latestThumb.LastModified}`);
          console.log(`   Size: ${(latestThumb.Size / 1024).toFixed(2)} KB`);
        } else {
          console.log(`   ⚠️ NO THUMBNAIL FOUND in S3!`);
        }
      } else {
        console.log(`   ❌ NO FILES in S3 for streamKey: ${streamKey}`);
      }
    } catch (error) {
      console.log(`   ❌ Error checking S3: ${error.message}`);
    }
    
    // Check DynamoDB files
    console.log(`\n💾 Checking DynamoDB files...`);
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
      console.log(`   ✅ Found ${dbFiles.Items.length} file(s) in DynamoDB`);
      
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
        console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
        console.log(`       hlsUrl: ${file.hlsUrl ? '✅ YES' : '❌ NO'}`);
        console.log(`       thumbnailUrl: ${file.thumbnailUrl ? '✅ YES' : '❌ NO'}`);
        if (file.thumbnailUrl) {
          console.log(`       thumbnailUrl value: ${file.thumbnailUrl}`);
          // Check if thumbnail URL is valid
          const isValid = file.thumbnailUrl && 
                         file.thumbnailUrl.trim() !== '' &&
                         file.thumbnailUrl !== 'null' &&
                         file.thumbnailUrl !== 'undefined' &&
                         file.thumbnailUrl.startsWith('http');
          console.log(`       thumbnailUrl valid: ${isValid ? '✅' : '❌'}`);
        }
      });
    } else {
      console.log(`   ❌ NO FILES in DynamoDB for streamKey: ${streamKey}`);
      console.log(`   → Lambda may not have processed S3 uploads yet`);
    }
    
    // Check visibility via get-content API logic
    console.log(`\n👁️ Checking visibility (get-content API logic)...`);
    const masterEmail = 'dehyu.sinyan@gmail.com';
    
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
      const thumbnailUrl = file.thumbnailUrl;
      const hasValidThumbnail = thumbnailUrl && 
                               thumbnailUrl.trim() !== '' &&
                               thumbnailUrl !== 'null' &&
                               thumbnailUrl !== 'undefined' &&
                               thumbnailUrl.startsWith('http');
      
      if (file.category === 'Videos') {
        if (!hasHls) return false;
        if (!hasStreamKey) return false;
        if (!hasValidThumbnail) return false;
      }
      
      return matchesChannel && isVisible && hasContent;
    });
    
    const streamKeyVideos = visibleVideos.filter(f => f.streamKey === streamKey);
    
    console.log(`   Querying: USER#${masterEmail}`);
    console.log(`   Channel: ${channelName}`);
    console.log(`   Total visible videos in channel: ${visibleVideos.length}`);
    console.log(`   Videos with this streamKey: ${streamKeyVideos.length}`);
    
    if (streamKeyVideos.length > 0) {
      console.log(`   ✅ Stream IS VISIBLE in channel`);
    } else {
      console.log(`   ❌ Stream is NOT VISIBLE in channel`);
      console.log(`   Reasons:`);
      const dbFile = dbFiles.Items?.[0];
      if (!dbFile) {
        console.log(`     - No DynamoDB entry found`);
      } else {
        if (dbFile.isVisible !== true) {
          console.log(`     - isVisible is false (${dbFile.isVisible})`);
        }
        if (!dbFile.hlsUrl) {
          console.log(`     - Missing hlsUrl`);
        }
        if (!dbFile.streamKey) {
          console.log(`     - Missing streamKey`);
        }
        const thumbnailUrl = dbFile.thumbnailUrl;
        const hasValidThumbnail = thumbnailUrl && 
                                 thumbnailUrl.trim() !== '' &&
                                 thumbnailUrl !== 'null' &&
                                 thumbnailUrl !== 'undefined' &&
                                 thumbnailUrl.startsWith('http');
        if (!hasValidThumbnail) {
          console.log(`     - Missing or invalid thumbnailUrl: ${thumbnailUrl || 'null/undefined'}`);
        }
      }
    }
  }
  
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
}

checkRecentStreams().catch(console.error);
