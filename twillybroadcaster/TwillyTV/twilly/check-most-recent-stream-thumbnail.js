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

async function checkMostRecentStreamThumbnail() {
  console.log('\n🔍 Checking Most Recent Stream Thumbnail Issue\n');
  console.log('='.repeat(80));
  
  const userEmail = 'dehyu.sinyan@gmail.com';
  const normalizedEmail = userEmail.toLowerCase();
  
  try {
    // Get the most recent FILE entry
    const filesQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${normalizedEmail}`,
        ':skPrefix': 'FILE#'
      },
      ScanIndexForward: false, // Newest first
      Limit: 1
    }).promise();
    
    if (!filesQuery.Items || filesQuery.Items.length === 0) {
      console.log('❌ No FILE entries found');
      return;
    }
    
    const mostRecent = filesQuery.Items[0];
    console.log(`\n📹 Most Recent Stream:`);
    console.log(`   fileName: ${mostRecent.fileName || 'MISSING'}`);
    console.log(`   streamKey: ${mostRecent.streamKey || 'MISSING'}`);
    console.log(`   uploadId: ${mostRecent.uploadId || 'MISSING'}`);
    console.log(`   createdAt: ${mostRecent.createdAt || 'MISSING'}`);
    console.log(`   thumbnailUrl: ${mostRecent.thumbnailUrl || 'MISSING'}`);
    
    if (mostRecent.thumbnailUrl && mostRecent.thumbnailUrl.includes('No_Image_Available')) {
      console.log(`\n❌ ISSUE: Thumbnail URL points to default "No_Image_Available.jpg"`);
      console.log(`   This means thumbnail generation failed or was never set`);
      
      // Check if thumbnail exists in S3 for this stream
      if (mostRecent.streamKey && mostRecent.uploadId) {
        console.log(`\n🔍 Checking S3 for thumbnail...`);
        
        // Try to find the thumbnail file
        const expectedThumbnailKey = `clips/${mostRecent.streamKey}/${mostRecent.uploadId}/${mostRecent.fileName?.replace('_master.m3u8', '_thumb.jpg') || 'thumb.jpg'}`;
        console.log(`   Expected thumbnail key: ${expectedThumbnailKey}`);
        
        try {
          // List all files in the uploadId directory
          const s3Files = await s3.listObjectsV2({
            Bucket: BUCKET_NAME,
            Prefix: `clips/${mostRecent.streamKey}/${mostRecent.uploadId}/`
          }).promise();
          
          if (s3Files.Contents && s3Files.Contents.length > 0) {
            console.log(`   ✅ Found ${s3Files.Contents.length} file(s) in S3:`);
            
            // Look for thumbnail
            const thumbnailFiles = s3Files.Contents.filter(f => 
              f.Key.includes('thumb') || f.Key.includes('thumbnail')
            );
            
            if (thumbnailFiles.length > 0) {
              console.log(`   ✅ Found ${thumbnailFiles.length} thumbnail file(s):`);
              thumbnailFiles.forEach((thumb, idx) => {
                console.log(`      [${idx + 1}] ${thumb.Key} (${(thumb.Size / 1024).toFixed(2)} KB)`);
              });
              
              // Get the correct thumbnail URL
              const correctThumbnail = thumbnailFiles[0];
              const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';
              const correctThumbnailUrl = `${cloudFrontBaseUrl}/${correctThumbnail.Key}`;
              
              console.log(`\n💡 SOLUTION: Update DynamoDB entry with correct thumbnail URL:`);
              console.log(`   Current: ${mostRecent.thumbnailUrl}`);
              console.log(`   Should be: ${correctThumbnailUrl}`);
              
              // Update the DynamoDB entry
              try {
                await dynamodb.update({
                  TableName: table,
                  Key: {
                    PK: mostRecent.PK,
                    SK: mostRecent.SK
                  },
                  UpdateExpression: 'SET thumbnailUrl = :thumbnailUrl',
                  ExpressionAttributeValues: {
                    ':thumbnailUrl': correctThumbnailUrl
                  }
                }).promise();
                
                console.log(`\n✅ Updated DynamoDB entry with correct thumbnail URL!`);
              } catch (updateError) {
                console.error(`\n❌ Failed to update DynamoDB: ${updateError.message}`);
              }
            } else {
              console.log(`   ❌ NO thumbnail files found in S3`);
              console.log(`   ⚠️  This means thumbnail was never generated or uploaded`);
              console.log(`   All files in directory:`);
              s3Files.Contents.slice(0, 10).forEach((f, idx) => {
                console.log(`      [${idx + 1}] ${f.Key}`);
              });
            }
          } else {
            console.log(`   ❌ NO files found in S3 for this uploadId`);
            console.log(`   ⚠️  This means the stream was never processed`);
          }
        } catch (s3Error) {
          console.error(`   ❌ Error checking S3: ${s3Error.message}`);
        }
      }
    } else if (mostRecent.thumbnailUrl) {
      console.log(`\n✅ Thumbnail URL looks valid: ${mostRecent.thumbnailUrl}`);
      
      // Verify it exists in S3
      try {
        const thumbnailKey = mostRecent.thumbnailUrl.replace('https://d4idc5cmwxlpy.cloudfront.net/', '');
        const headResult = await s3.headObject({
          Bucket: BUCKET_NAME,
          Key: thumbnailKey
        }).promise();
        console.log(`   ✅ Thumbnail EXISTS in S3 (${(headResult.ContentLength / 1024).toFixed(2)} KB)`);
      } catch (s3Error) {
        if (s3Error.code === 'NotFound') {
          console.log(`   ❌ Thumbnail URL points to NON-EXISTENT file in S3!`);
        } else {
          console.log(`   ⚠️  Error checking S3: ${s3Error.message}`);
        }
      }
    } else {
      console.log(`\n❌ NO thumbnailUrl field in DynamoDB entry`);
    }
    
    // Check private stream visibility
    console.log(`\n\n${'='.repeat(80)}`);
    console.log(`Checking Private Stream Visibility`);
    console.log(`${'='.repeat(80)}\n`);
    
    if (mostRecent.isPrivateUsername === true) {
      console.log(`✅ This is a PRIVATE stream (isPrivateUsername: true)`);
      console.log(`   creatorUsername: ${mostRecent.creatorUsername || 'MISSING'}`);
      console.log(`   hlsUrl: ${mostRecent.hlsUrl ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`   isVisible: ${mostRecent.isVisible !== false ? 'true' : 'false'}`);
      
      console.log(`\n💡 To see this private stream:`);
      console.log(`   1. Make sure you're viewing in PRIVATE mode (showPrivateContent=true)`);
      console.log(`   2. Make sure you're logged in as the owner or have been added as a private viewer`);
      console.log(`   3. Check that get-content endpoint filters correctly for private streams`);
    } else {
      console.log(`ℹ️  This is a PUBLIC stream`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMostRecentStreamThumbnail();
