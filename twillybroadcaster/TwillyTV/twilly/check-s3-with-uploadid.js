const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'theprivatecollection';

async function checkS3WithUploadId() {
  console.log('🔍 Checking S3 files with uploadId in path (last 2 hours)...\n');
  
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  
  try {
    // List all files in clips/ directory
    const result = await s3.listObjectsV2({
      Bucket: BUCKET_NAME,
      Prefix: 'clips/',
      MaxKeys: 1000
    }).promise();
    
    const recentFiles = (result.Contents || []).filter(file => {
      return new Date(file.LastModified).getTime() >= twoHoursAgo;
    }).sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
    
    console.log(`✅ Found ${recentFiles.length} recent S3 file(s) in last 2 hours\n`);
    
    // Group by streamKey and uploadId
    const filesByStream = {};
    
    recentFiles.forEach(file => {
      // Match: clips/{streamKey}/{uploadId}/{filename}
      const match1 = file.Key.match(/clips\/([^\/]+)\/([^\/]+)\/(.+)/);
      // Match: clips/{streamKey}/{filename} (old format)
      const match2 = file.Key.match(/clips\/([^\/]+)\/(.+)/);
      
      if (match1) {
        const [, streamKey, uploadId, filename] = match1;
        if (!filesByStream[streamKey]) {
          filesByStream[streamKey] = {};
        }
        if (!filesByStream[streamKey][uploadId]) {
          filesByStream[streamKey][uploadId] = [];
        }
        filesByStream[streamKey][uploadId].push({ key: file.Key, modified: file.LastModified, size: file.Size });
      } else if (match2) {
        const [, streamKey, filename] = match2;
        if (!filesByStream[streamKey]) {
          filesByStream[streamKey] = {};
        }
        if (!filesByStream[streamKey]['no-uploadid']) {
          filesByStream[streamKey]['no-uploadid'] = [];
        }
        filesByStream[streamKey]['no-uploadid'].push({ key: file.Key, modified: file.LastModified, size: file.Size });
      }
    });
    
    console.log('📊 Files grouped by streamKey and uploadId:\n');
    
    Object.keys(filesByStream).slice(0, 10).forEach(streamKey => {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`StreamKey: ${streamKey}`);
      
      Object.keys(filesByStream[streamKey]).forEach(uploadId => {
        const files = filesByStream[streamKey][uploadId];
        const minutesAgo = Math.floor((Date.now() - new Date(files[0].modified).getTime()) / 60000);
        console.log(`\n  UploadId: ${uploadId === 'no-uploadid' ? '(old format)' : uploadId} (${minutesAgo} minutes ago)`);
        console.log(`  Files: ${files.length}`);
        
        const thumbnails = files.filter(f => f.key.includes('_thumb.jpg'));
        const masterPlaylists = files.filter(f => f.key.includes('_master.m3u8'));
        const hlsFiles = files.filter(f => f.key.endsWith('.m3u8') || f.key.endsWith('.ts'));
        
        console.log(`    - Thumbnails: ${thumbnails.length} ${thumbnails.length > 0 ? '✅' : '❌'}`);
        if (thumbnails.length > 0) {
          thumbnails.forEach(t => {
            const keyParts = t.key.split('/');
            console.log(`      → ${keyParts[keyParts.length - 1]}`);
          });
        }
        
        console.log(`    - Master playlists: ${masterPlaylists.length} ${masterPlaylists.length > 0 ? '✅' : '❌'}`);
        console.log(`    - HLS files: ${hlsFiles.length} ${hlsFiles.length > 0 ? '✅' : '❌'}`);
        
        // Check if this might be a 15-minute stream (look for longer duration indicators)
        const totalSizeMB = files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
        if (totalSizeMB > 50) {
          console.log(`    - Total size: ${totalSizeMB.toFixed(2)} MB (might be 15-minute stream)`);
        }
      });
    });
    
    // Check for the specific missing thumbnail
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('🔍 Checking for missing thumbnail from 10-second stream...\n');
    
    const missingThumbnailKey = 'clips/sk_grjnembh56nw87yl/sk_grjnembh56nw87yl_2026-02-10T00-49-00-434Z_fxca0uvj_thumb.jpg';
    console.log(`Looking for: ${missingThumbnailKey}`);
    
    try {
      await s3.headObject({
        Bucket: BUCKET_NAME,
        Key: missingThumbnailKey
      }).promise();
      console.log('✅ Thumbnail EXISTS!');
    } catch (error) {
      if (error.code === 'NotFound') {
        console.log('❌ Thumbnail NOT FOUND');
        console.log('\n🔍 Checking if thumbnail exists with uploadId in path...');
        
        // Try with uploadId: fxca0uvj
        const uploadId = 'fxca0uvj';
        const altKey = `clips/sk_grjnembh56nw87yl/${uploadId}/sk_grjnembh56nw87yl_2026-02-10T00-49-00-434Z_fxca0uvj_thumb.jpg`;
        console.log(`Trying: ${altKey}`);
        
        try {
          await s3.headObject({
            Bucket: BUCKET_NAME,
            Key: altKey
          }).promise();
          console.log('✅ Thumbnail EXISTS with uploadId in path!');
          console.log('   → ISSUE: DynamoDB has wrong S3 key (missing uploadId in path)');
        } catch (altError) {
          console.log('❌ Thumbnail NOT FOUND with uploadId either');
          console.log('   → ISSUE: Thumbnail upload failed during early thumbnail generation');
        }
      }
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

checkS3WithUploadId().catch(console.error);
