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

async function checkVeryRecentStreams() {
  console.log('🔍 Checking VERY recent S3 files (last 30 minutes)...\n');
  console.log('='.repeat(80));
  
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  try {
    // List all files in clips/ from last 30 minutes
    console.log('📦 Listing S3 files from last 30 minutes...\n');
    const s3List = await s3.listObjectsV2({
      Bucket: BUCKET_NAME,
      Prefix: 'clips/',
      MaxKeys: 200
    }).promise();
    
    if (!s3List.Contents || s3List.Contents.length === 0) {
      console.log('❌ No files found in S3');
      return;
    }
    
    // Filter for very recent files
    const recentFiles = s3List.Contents
      .filter(obj => obj.LastModified >= thirtyMinutesAgo)
      .sort((a, b) => b.LastModified.getTime() - a.LastModified.getTime());
    
    if (recentFiles.length === 0) {
      console.log('⚠️ No files found in the last 30 minutes');
      console.log('   Checking last 10 files regardless of time...\n');
      
      // Show last 10 files regardless of time
      const last10 = s3List.Contents
        .sort((a, b) => b.LastModified.getTime() - a.LastModified.getTime())
        .slice(0, 10);
      
      last10.forEach((file, idx) => {
        const timeAgo = Math.round((Date.now() - file.LastModified.getTime()) / 1000 / 60);
        console.log(`[${idx + 1}] ${file.Key}`);
        console.log(`    Modified: ${file.LastModified} (${timeAgo} minutes ago)`);
        console.log(`    Size: ${(file.Size / 1024).toFixed(2)} KB`);
      });
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
      console.log(`Total files: ${files.length}`);
      
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
        console.log(`\n   📹 Latest playlist:`);
        console.log(`   ${latest.Key}`);
        console.log(`   Modified: ${latest.LastModified} (${timeAgo} minutes ago)`);
        console.log(`   Size: ${(latest.Size / 1024).toFixed(2)} KB`);
      }
      
      if (thumbnails.length > 0) {
        const latestThumb = thumbnails.sort((a, b) => 
          b.LastModified.getTime() - a.LastModified.getTime()
        )[0];
        const timeAgo = Math.round((Date.now() - latestThumb.LastModified.getTime()) / 1000 / 60);
        console.log(`\n   🖼️ Latest thumbnail:`);
        console.log(`   ${latestThumb.Key}`);
        console.log(`   Modified: ${latestThumb.LastModified} (${timeAgo} minutes ago)`);
        console.log(`   Size: ${(latestThumb.Size / 1024).toFixed(2)} KB`);
      } else {
        console.log(`\n   ⚠️ NO THUMBNAIL FOUND!`);
        console.log(`   → This is the issue - thumbnail was not generated or uploaded`);
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
          console.log(`\n   [${idx + 1}] ${file.fileName || file.SK}`);
          console.log(`       Stored under: ${file.PK}`);
          console.log(`       folderName: ${file.folderName || 'N/A'}`);
          console.log(`       isVisible: ${file.isVisible}`);
          console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
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
              console.log(`       ⚠️ INVALID thumbnailUrl: ${file.thumbnailUrl}`);
            } else {
              console.log(`       thumbnailUrl: ${file.thumbnailUrl}`);
            }
          } else {
            console.log(`       ⚠️ MISSING thumbnailUrl - video will be filtered out!`);
          }
        });
      } else {
        console.log(`   ❌ NO FILES in DynamoDB for streamKey: ${streamKey}`);
        console.log(`   → Lambda has NOT processed these S3 files yet`);
        console.log(`   → Possible causes:`);
        console.log(`      - Lambda not triggered by S3 event`);
        console.log(`      - Lambda error during processing`);
        console.log(`      - Lambda timeout`);
        console.log(`      - S3 event notification not configured correctly`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error);
  }
}

checkVeryRecentStreams().catch(console.error);
