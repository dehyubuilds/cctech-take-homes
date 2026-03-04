const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-2' // Bucket is in us-east-2
});
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });
const table = 'Twilly';
const BUCKET_NAME = 'theprivatecollection';

async function checkRecentS3Files() {
  console.log('🔍 Checking recent S3 files (last 2 hours)...\n');
  console.log('='.repeat(80));
  
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  
  try {
    // List all files in clips/ from last 2 hours
    console.log('📦 Listing S3 files from last 2 hours...\n');
    const s3List = await s3.listObjectsV2({
      Bucket: BUCKET_NAME,
      Prefix: 'clips/',
      MaxKeys: 1000
    }).promise();
    
    if (!s3List.Contents || s3List.Contents.length === 0) {
      console.log('❌ No files found in S3');
      return;
    }
    
    // Filter for recent files
    const recentFiles = s3List.Contents
      .filter(obj => obj.LastModified >= twoHoursAgo)
      .sort((a, b) => b.LastModified.getTime() - a.LastModified.getTime());
    
    if (recentFiles.length === 0) {
      console.log('⚠️ No files found in the last 2 hours');
      return;
    }
    
    console.log(`✅ Found ${recentFiles.length} recent file(s)\n`);
    
    // Group by streamKey
    const filesByStreamKey = {};
    recentFiles.forEach(file => {
      const parts = file.Key.split('/');
      if (parts.length >= 2) {
        const streamKey = parts[1];
        if (!filesByStreamKey[streamKey]) {
          filesByStreamKey[streamKey] = [];
        }
        filesByStreamKey[streamKey].push(file);
      }
    });
    
    console.log(`Found ${Object.keys(filesByStreamKey).length} unique streamKey(s)\n`);
    
    // Check each streamKey
    for (const [streamKey, files] of Object.entries(filesByStreamKey)) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`StreamKey: ${streamKey}`);
      console.log(`Files: ${files.length}`);
      
      const masterPlaylists = files.filter(f => f.Key.includes('_master.m3u8'));
      const thumbnails = files.filter(f => f.Key.includes('_thumb.jpg'));
      const segments = files.filter(f => f.Key.includes('.ts'));
      
      console.log(`   Master playlists: ${masterPlaylists.length}`);
      console.log(`   Thumbnails: ${thumbnails.length}`);
      console.log(`   Video segments: ${segments.length}`);
      
      if (masterPlaylists.length > 0) {
        const latest = masterPlaylists.sort((a, b) => 
          b.LastModified.getTime() - a.LastModified.getTime()
        )[0];
        const timeAgo = Math.round((Date.now() - latest.LastModified.getTime()) / 1000 / 60);
        console.log(`   Latest playlist: ${latest.Key}`);
        console.log(`   Modified: ${latest.LastModified} (${timeAgo} minutes ago)`);
      }
      
      if (thumbnails.length > 0) {
        const latestThumb = thumbnails.sort((a, b) => 
          b.LastModified.getTime() - a.LastModified.getTime()
        )[0];
        console.log(`   ✅ Latest thumbnail: ${latestThumb.Key}`);
        console.log(`   Modified: ${latestThumb.LastModified}`);
        console.log(`   Size: ${(latestThumb.Size / 1024).toFixed(2)} KB`);
      } else {
        console.log(`   ⚠️ NO THUMBNAIL FOUND!`);
      }
      
      // Check DynamoDB
      console.log(`\n💾 Checking DynamoDB...`);
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
        dbFiles.Items.forEach((file, idx) => {
          console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
          console.log(`       Stored under: ${file.PK}`);
          console.log(`       isVisible: ${file.isVisible}`);
          console.log(`       hlsUrl: ${file.hlsUrl ? '✅' : '❌'}`);
          console.log(`       thumbnailUrl: ${file.thumbnailUrl ? '✅' : '❌'}`);
          if (file.thumbnailUrl) {
            const isValid = file.thumbnailUrl && 
                           file.thumbnailUrl.trim() !== '' &&
                           file.thumbnailUrl !== 'null' &&
                           file.thumbnailUrl !== 'undefined' &&
                           file.thumbnailUrl.startsWith('http');
            console.log(`       thumbnailUrl valid: ${isValid ? '✅' : '❌'}`);
            if (!isValid) {
              console.log(`       thumbnailUrl value: ${file.thumbnailUrl}`);
            }
          }
        });
      } else {
        console.log(`   ❌ NO FILES in DynamoDB for streamKey: ${streamKey}`);
        console.log(`   → Lambda has NOT processed these S3 files yet`);
        console.log(`   → Check Lambda logs or manually trigger processing`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error);
  }
}

checkRecentS3Files().catch(console.error);
