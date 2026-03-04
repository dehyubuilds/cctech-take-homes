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

async function investigateMissingThumbnailAndPrivateStream() {
  console.log('\n🔍 Investigating Missing Thumbnail and Private Stream Issues\n');
  console.log('=' .repeat(80));
  
  // Get user email from command line or use default
  const userEmail = process.argv[2] || 'dehyu.sinyan@gmail.com';
  const normalizedEmail = userEmail.toLowerCase();
  
  console.log(`\n📧 Checking streams for: ${normalizedEmail}\n`);
  
  try {
    // Step 1: Get all recent FILE entries for this user
    console.log('STEP 1: Fetching recent FILE entries from DynamoDB...\n');
    const filesQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${normalizedEmail}`,
        ':skPrefix': 'FILE#'
      },
      ScanIndexForward: false, // Newest first
      Limit: 10
    }).promise();
    
    if (!filesQuery.Items || filesQuery.Items.length === 0) {
      console.log('❌ No FILE entries found for this user');
      return;
    }
    
    console.log(`✅ Found ${filesQuery.Items.length} recent FILE entries:\n`);
    
    for (let i = 0; i < filesQuery.Items.length; i++) {
      const file = filesQuery.Items[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📹 FILE ${i + 1}: ${file.fileName || file.SK}`);
      console.log(`${'='.repeat(80)}`);
      
      // Basic info
      console.log(`\n📋 Basic Info:`);
      console.log(`   SK: ${file.SK}`);
      console.log(`   fileName: ${file.fileName || 'MISSING'}`);
      console.log(`   streamKey: ${file.streamKey || 'MISSING'}`);
      console.log(`   uploadId: ${file.uploadId || 'MISSING'}`);
      console.log(`   createdAt: ${file.createdAt || 'MISSING'}`);
      console.log(`   folderName (channel): ${file.folderName || 'MISSING'}`);
      
      // Thumbnail check
      console.log(`\n🖼️  Thumbnail Status:`);
      if (file.thumbnailUrl) {
        console.log(`   ✅ thumbnailUrl: ${file.thumbnailUrl}`);
        
        // Check if thumbnail exists in S3
        try {
          const thumbnailKey = file.thumbnailUrl.replace('https://d4idc5cmwxlpy.cloudfront.net/', '');
          const headResult = await s3.headObject({
            Bucket: BUCKET_NAME,
            Key: thumbnailKey
          }).promise();
          console.log(`   ✅ Thumbnail EXISTS in S3 (${(headResult.ContentLength / 1024).toFixed(2)} KB)`);
        } catch (s3Error) {
          if (s3Error.code === 'NotFound') {
            console.log(`   ❌ Thumbnail URL points to NON-EXISTENT file in S3!`);
            console.log(`   ⚠️  This is the problem - thumbnail was never uploaded or was deleted`);
          } else {
            console.log(`   ⚠️  Error checking S3: ${s3Error.message}`);
          }
        }
      } else {
        console.log(`   ❌ NO thumbnailUrl field in DynamoDB entry!`);
        console.log(`   ⚠️  This is the problem - thumbnail was never set during processing`);
      }
      
      // Privacy check
      console.log(`\n🔒 Privacy Status:`);
      console.log(`   isPrivateUsername: ${file.isPrivateUsername || false}`);
      console.log(`   creatorUsername: ${file.creatorUsername || 'MISSING'}`);
      const hasLock = file.creatorUsername && file.creatorUsername.includes('🔒');
      console.log(`   Has lock emoji (🔒): ${hasLock}`);
      
      if (file.isPrivateUsername || hasLock) {
        console.log(`   ✅ This is a PRIVATE stream`);
      } else {
        console.log(`   ℹ️  This is a PUBLIC stream`);
      }
      
      // StreamKey mapping check
      if (file.streamKey) {
        console.log(`\n🔑 StreamKey Mapping:`);
        try {
          const mappingResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `STREAM_KEY#${file.streamKey}`,
              SK: 'MAPPING'
            }
          }).promise();
          
          if (mappingResult.Item) {
            console.log(`   ✅ StreamKey mapping exists`);
            console.log(`   isPrivateUsername in mapping: ${mappingResult.Item.isPrivateUsername || false}`);
            console.log(`   streamUsername: ${mappingResult.Item.streamUsername || 'MISSING'}`);
            
            // Check if mapping and file have matching privacy
            const mappingIsPrivate = mappingResult.Item.isPrivateUsername === true;
            const fileIsPrivate = file.isPrivateUsername === true || hasLock;
            
            if (mappingIsPrivate !== fileIsPrivate) {
              console.log(`   ⚠️  PRIVACY MISMATCH!`);
              console.log(`      Mapping says: ${mappingIsPrivate ? 'PRIVATE' : 'PUBLIC'}`);
              console.log(`      File says: ${fileIsPrivate ? 'PRIVATE' : 'PUBLIC'}`);
            }
          } else {
            console.log(`   ❌ StreamKey mapping NOT FOUND`);
          }
        } catch (error) {
          console.log(`   ❌ Error checking mapping: ${error.message}`);
        }
      }
      
      // S3 files check
      if (file.streamKey) {
        console.log(`\n☁️  S3 Files:`);
        try {
          const s3Files = await s3.listObjectsV2({
            Bucket: BUCKET_NAME,
            Prefix: `clips/${file.streamKey}/`
          }).promise();
          
          if (s3Files.Contents && s3Files.Contents.length > 0) {
            console.log(`   ✅ Found ${s3Files.Contents.length} file(s) in S3:`);
            
            // Check for thumbnail
            const thumbnailFiles = s3Files.Contents.filter(f => 
              f.Key.includes('thumb') || f.Key.includes('thumbnail')
            );
            
            if (thumbnailFiles.length > 0) {
              console.log(`   ✅ Found ${thumbnailFiles.length} thumbnail file(s):`);
              thumbnailFiles.forEach((thumb, idx) => {
                console.log(`      [${idx + 1}] ${thumb.Key} (${(thumb.Size / 1024).toFixed(2)} KB)`);
              });
            } else {
              console.log(`   ❌ NO thumbnail files found in S3 for this streamKey!`);
              console.log(`   ⚠️  This confirms the thumbnail was never generated/uploaded`);
            }
            
            // List all files
            console.log(`   📁 All files:`);
            s3Files.Contents.slice(0, 5).forEach((f, idx) => {
              console.log(`      [${idx + 1}] ${f.Key} (${(f.Size / 1024 / 1024).toFixed(2)} MB)`);
            });
            if (s3Files.Contents.length > 5) {
              console.log(`      ... and ${s3Files.Contents.length - 5} more files`);
            }
          } else {
            console.log(`   ❌ NO files found in S3 for streamKey: ${file.streamKey}`);
            console.log(`   ⚠️  This means the stream was never processed or uploaded`);
          }
        } catch (error) {
          console.log(`   ❌ Error checking S3: ${error.message}`);
        }
      }
      
      // HLS URL check
      console.log(`\n📺 Video URLs:`);
      console.log(`   hlsUrl: ${file.hlsUrl || 'MISSING'}`);
      console.log(`   isVisible: ${file.isVisible !== false ? 'true' : 'false'}`);
    }
    
    // Step 2: Check for private streams specifically
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`STEP 2: Checking for PRIVATE streams`);
    console.log(`${'='.repeat(80)}\n`);
    
    const privateFiles = filesQuery.Items.filter(f => 
      f.isPrivateUsername === true || 
      (f.creatorUsername && f.creatorUsername.includes('🔒'))
    );
    
    if (privateFiles.length > 0) {
      console.log(`✅ Found ${privateFiles.length} PRIVATE stream(s):\n`);
      privateFiles.forEach((file, idx) => {
        console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
        console.log(`       createdAt: ${file.createdAt}`);
        console.log(`       creatorUsername: ${file.creatorUsername || 'MISSING'}`);
        console.log(`       isPrivateUsername: ${file.isPrivateUsername || false}`);
        console.log(`       thumbnailUrl: ${file.thumbnailUrl ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log(`       hlsUrl: ${file.hlsUrl ? '✅ EXISTS' : '❌ MISSING'}`);
        console.log('');
      });
    } else {
      console.log(`⚠️  NO PRIVATE streams found in recent entries`);
      console.log(`   This could mean:`);
      console.log(`   1. Private streams are not being saved correctly`);
      console.log(`   2. isPrivateUsername is not being set in DynamoDB`);
      console.log(`   3. Private streams are being filtered out somewhere`);
    }
    
    // Step 3: Summary
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`SUMMARY`);
    console.log(`${'='.repeat(80)}\n`);
    
    const missingThumbnails = filesQuery.Items.filter(f => !f.thumbnailUrl);
    const missingPrivateStreams = filesQuery.Items.filter(f => 
      (f.isPrivateUsername === true || (f.creatorUsername && f.creatorUsername.includes('🔒'))) &&
      !f.hlsUrl
    );
    
    console.log(`📊 Statistics:`);
    console.log(`   Total streams checked: ${filesQuery.Items.length}`);
    console.log(`   Missing thumbnails: ${missingThumbnails.length}`);
    console.log(`   Private streams found: ${privateFiles.length}`);
    console.log(`   Private streams missing HLS: ${missingPrivateStreams.length}`);
    
    if (missingThumbnails.length > 0) {
      console.log(`\n❌ ISSUE: ${missingThumbnails.length} stream(s) missing thumbnails:`);
      missingThumbnails.forEach(f => {
        console.log(`   - ${f.fileName || f.SK} (streamKey: ${f.streamKey || 'N/A'})`);
      });
    }
    
    if (missingPrivateStreams.length > 0) {
      console.log(`\n❌ ISSUE: ${missingPrivateStreams.length} private stream(s) missing HLS URLs:`);
      missingPrivateStreams.forEach(f => {
        console.log(`   - ${f.fileName || f.SK} (streamKey: ${f.streamKey || 'N/A'})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run investigation
investigateMissingThumbnailAndPrivateStream();
