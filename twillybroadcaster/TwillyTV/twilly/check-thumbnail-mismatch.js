const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({ region: 'us-east-2' });
const table = 'Twilly';
const BUCKET_NAME = 'theprivatecollection';

async function checkThumbnailMismatch() {
  console.log('🔍 Checking thumbnail mismatch for recent videos...\n');
  console.log('='.repeat(80));
  
  const masterEmail = 'dehyu.sinyan@gmail.com';
  
  // Get recent videos
  const filesQuery = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${masterEmail}`,
      ':skPrefix': 'FILE#'
    }
  }).promise();
  
  const recentVideos = (filesQuery.Items || [])
    .filter(f => f.category === 'Videos' && f.streamKey && f.folderName === 'Twilly TV')
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || a.timestamp || 0);
      const dateB = new Date(b.createdAt || b.timestamp || 0);
      return dateB - dateA;
    })
    .slice(0, 5); // Check last 5 videos
  
  console.log(`Checking ${recentVideos.length} recent videos...\n`);
  
  for (const video of recentVideos) {
    const timeAgo = Math.round((Date.now() - new Date(video.createdAt || video.timestamp || 0).getTime()) / 1000 / 60);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Video: ${video.fileName || video.SK}`);
    console.log(`Created: ${timeAgo} minutes ago`);
    console.log(`streamKey: ${video.streamKey}`);
    
    if (!video.thumbnailUrl) {
      console.log(`\n❌ MISSING thumbnailUrl in DynamoDB!`);
      continue;
    }
    
    // Extract expected S3 key from thumbnailUrl
    const thumbnailUrl = video.thumbnailUrl;
    const urlMatch = thumbnailUrl.match(/https:\/\/[^\/]+\/(.+)/);
    if (!urlMatch) {
      console.log(`\n⚠️ Could not parse thumbnail URL: ${thumbnailUrl}`);
      continue;
    }
    
    const expectedS3Key = urlMatch[1];
    console.log(`\nExpected thumbnail S3 key: ${expectedS3Key}`);
    
    // Check if this exact file exists in S3
    try {
      await s3.headObject({
        Bucket: BUCKET_NAME,
        Key: expectedS3Key
      }).promise();
      console.log(`✅ Thumbnail EXISTS in S3 at expected path!`);
    } catch (error) {
      if (error.code === 'NotFound') {
        console.log(`❌ Thumbnail NOT FOUND in S3 at expected path!`);
        console.log(`   → This is why the video shows but has no thumbnail`);
        
        // Check what thumbnails DO exist for this streamKey
        console.log(`\n   Checking what thumbnails exist for streamKey: ${video.streamKey}...`);
        const s3Files = await s3.listObjectsV2({
          Bucket: BUCKET_NAME,
          Prefix: `clips/${video.streamKey}/`,
          MaxKeys: 100
        }).promise();
        
        if (s3Files.Contents && s3Files.Contents.length > 0) {
          const thumbnails = s3Files.Contents.filter(f => f.Key.includes('_thumb.jpg'));
          if (thumbnails.length > 0) {
            console.log(`   Found ${thumbnails.length} thumbnail(s) in S3:`);
            thumbnails.forEach((thumb, idx) => {
              const timeAgo = Math.round((Date.now() - thumb.LastModified.getTime()) / 1000 / 60);
              console.log(`   [${idx + 1}] ${thumb.Key}`);
              console.log(`       Modified: ${thumb.LastModified} (${timeAgo} minutes ago)`);
            });
            console.log(`\n   ⚠️ ISSUE: Thumbnail exists but with different name/path!`);
            console.log(`   → Lambda or streaming service is not uploading thumbnails correctly`);
          } else {
            console.log(`   ❌ NO THUMBNAILS found in S3 for this streamKey!`);
            console.log(`   → Thumbnail was never generated or uploaded`);
          }
        } else {
          console.log(`   ❌ NO FILES found in S3 for this streamKey!`);
        }
      } else {
        console.log(`   ❌ Error checking S3: ${error.message}`);
      }
    }
  }
}

checkThumbnailMismatch().catch(console.error);
