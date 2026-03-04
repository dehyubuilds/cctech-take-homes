const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const s3 = new AWS.S3();
const BUCKET_NAME = 'theprivatecollection';

async function testLambdaPathParsing() {
  console.log('🔍 Testing Lambda S3 Path Parsing Logic\n');
  console.log('='.repeat(80));
  
  // Test case 1: The problematic format
  const testKey1 = 'clips/twillytvdur4k9l2/twillytvdur4k9l2_2026-01-29T01-40-54-790Z_wpux9jqt_master.m3u8';
  console.log(`\n📋 TEST CASE 1: Problematic format`);
  console.log(`   S3 Key: ${testKey1}`);
  
  // Simulate Lambda parsing logic
  const pathParts1 = testKey1.split('/');
  console.log(`   Path parts: [${pathParts1.join(', ')}]`);
  console.log(`   Length: ${pathParts1.length}`);
  
  if (pathParts1.length >= 4) {
    console.log(`   ✅ Lambda thinks this is NEW format (with uploadId)`);
    const potentialUploadId = pathParts1[2];
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (potentialUploadId.startsWith('upload-') || uuidPattern.test(potentialUploadId)) {
      console.log(`   ✅ UploadId detected: ${potentialUploadId}`);
    } else {
      console.log(`   ❌ UploadId NOT detected (${potentialUploadId} doesn't match pattern)`);
      console.log(`   → Lambda will use OLD format parsing`);
    }
  } else if (pathParts1.length === 3) {
    console.log(`   ✅ Lambda thinks this is OLD format (no uploadId)`);
    const lastPart = pathParts1[2];
    console.log(`   Filename: ${lastPart}`);
    
    // Extract streamName from filename
    const videoExtensions = ['.m3u8', '.ts', '.mp4', '.mov', '.avi'];
    let foundExtension = null;
    let extensionIndex = -1;
    
    for (const ext of videoExtensions) {
      const index = lastPart.lastIndexOf(ext);
      if (index !== -1) {
        foundExtension = ext;
        extensionIndex = index;
        break;
      }
    }
    
    if (foundExtension && extensionIndex > 0) {
      const beforeExtension = lastPart.substring(0, extensionIndex);
      const lastUnderscoreIndex = beforeExtension.lastIndexOf('_');
      if (lastUnderscoreIndex > 0) {
        const streamName = beforeExtension.substring(0, lastUnderscoreIndex);
        console.log(`   ✅ Extracted streamName: ${streamName}`);
        console.log(`   ❌ PROBLEM: streamName (${streamName}) != streamKey (twillytvdur4k9l2)`);
        console.log(`   → Lambda will look up streamKey mapping with WRONG streamKey!`);
      } else {
        const streamName = beforeExtension;
        console.log(`   ✅ Extracted streamName: ${streamName}`);
        console.log(`   ❌ PROBLEM: streamName (${streamName}) != streamKey (twillytvdur4k9l2)`);
      }
    }
  }
  
  // Test case 2: Expected new format
  const testKey2 = 'clips/twillytvdur4k9l2/wpux9jqt/twillytvdur4k9l2_2026-01-29T01-40-54-790Z_wpux9jqt_master.m3u8';
  console.log(`\n📋 TEST CASE 2: Expected NEW format`);
  console.log(`   S3 Key: ${testKey2}`);
  
  const pathParts2 = testKey2.split('/');
  console.log(`   Path parts: [${pathParts2.join(', ')}]`);
  console.log(`   Length: ${pathParts2.length}`);
  
  if (pathParts2.length >= 4) {
    const potentialUploadId = pathParts2[2];
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (potentialUploadId.startsWith('upload-') || uuidPattern.test(potentialUploadId)) {
      console.log(`   ✅ UploadId detected: ${potentialUploadId}`);
      console.log(`   ✅ Lambda will use NEW format parsing`);
    } else {
      console.log(`   ❌ UploadId NOT detected (${potentialUploadId} doesn't match pattern)`);
    }
  }
  
  // Test case 3: Check actual S3 files
  console.log(`\n📋 TEST CASE 3: Actual S3 Files`);
  const s3Files = await s3.listObjectsV2({
    Bucket: BUCKET_NAME,
    Prefix: 'clips/twillytvdur4k9l2/',
    MaxKeys: 10
  }).promise();
  
  if (s3Files.Contents && s3Files.Contents.length > 0) {
    console.log(`   Found ${s3Files.Contents.length} file(s):`);
    s3Files.Contents.slice(0, 5).forEach((file, idx) => {
      const pathParts = file.Key.split('/');
      console.log(`   [${idx + 1}] ${file.Key}`);
      console.log(`       Parts: ${pathParts.length} (${pathParts.join(' / ')})`);
      if (pathParts.length === 3) {
        console.log(`       ⚠️ OLD format - Lambda will extract streamName from filename`);
      } else if (pathParts.length >= 4) {
        console.log(`       ✅ NEW format - Lambda will use uploadId`);
      }
    });
  }
  
  // Summary
  console.log(`\n\n📊 SUMMARY:`);
  console.log(`   The issue is:`);
  console.log(`   1. S3 files are stored as: clips/{streamKey}/{streamKey_timestamp_uploadId_master.m3u8}`);
  console.log(`   2. Lambda expects: clips/{streamKey}/{uploadId}/{filename} OR clips/{streamKey}/{filename}`);
  console.log(`   3. Lambda extracts streamName from filename, but filename contains streamKey + timestamp + uploadId`);
  console.log(`   4. Lambda extracts: streamName = "twillytvdur4k9l2_2026-01-29T01-40-54-790Z"`);
  console.log(`   5. Lambda looks up streamKey mapping with streamKey = "twillytvdur4k9l2_2026-01-29T01-40-54-790Z"`);
  console.log(`   6. StreamKey mapping doesn't exist for that, so Lambda skips the file!`);
}

testLambdaPathParsing().catch(console.error);
