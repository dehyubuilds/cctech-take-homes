const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-2'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const table = 'Twilly';
const BUCKET_NAME = 'theprivatecollection';

async function check15MinStream() {
  console.log('🔍 Checking for 15-minute stream (last 2 hours)...\n');
  
  // Get all recent video entries
  const masterEmail = 'dehyu.sinyan@gmail.com';
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  try {
    // Query for recent files under master account
    const result = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'createdAt >= :twoHoursAgo',
      ExpressionAttributeValues: {
        ':pk': `USER#${masterEmail}`,
        ':skPrefix': 'FILE#',
        ':twoHoursAgo': twoHoursAgo
      }
    }).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log('⚠️ No recent video entries found in last 2 hours');
      console.log('   Checking S3 for any recent uploads...\n');
      
      // Check S3 for recent files
      const s3Result = await s3.listObjectsV2({
        Bucket: BUCKET_NAME,
        Prefix: 'clips/',
        MaxKeys: 50
      }).promise();
      
      if (s3Result.Contents && s3Result.Contents.length > 0) {
        console.log(`📦 Found ${s3Result.Contents.length} recent S3 files:`);
        const recentFiles = s3Result.Contents
          .filter(file => {
            const fileTime = new Date(file.LastModified);
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            return fileTime >= twoHoursAgo;
          })
          .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
        
        if (recentFiles.length > 0) {
          console.log(`\n✅ Found ${recentFiles.length} files in last 2 hours:`);
          recentFiles.slice(0, 10).forEach((file, index) => {
            const minutesAgo = Math.floor((Date.now() - new Date(file.LastModified).getTime()) / 60000);
            console.log(`\n[${index + 1}] ${file.Key}`);
            console.log(`   Modified: ${file.LastModified} (${minutesAgo} minutes ago)`);
            console.log(`   Size: ${(file.Size / 1024).toFixed(2)} KB`);
          });
        } else {
          console.log('⚠️ No S3 files found in last 2 hours');
        }
      }
      return;
    }
    
    console.log(`✅ Found ${result.Items.length} recent video(s):\n`);
    
    // Sort by createdAt (most recent first)
    const videos = result.Items.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.timestamp || 0);
      const timeB = new Date(b.createdAt || b.timestamp || 0);
      return timeB - timeA;
    });
    
    for (let i = 0; i < Math.min(10, videos.length); i++) {
      const video = videos[i];
      const createdAt = new Date(video.createdAt || video.timestamp);
      const minutesAgo = Math.floor((Date.now() - createdAt.getTime()) / 60000);
      
      console.log(`================================================================================`);
      console.log(`[${i + 1}] ${video.fileName || video.SK}`);
      console.log(`Created: ${createdAt.toISOString()} (${minutesAgo} minutes ago)`);
      console.log(`streamKey: ${video.streamKey || 'N/A'}`);
      console.log(`folderName: ${video.folderName || 'N/A'}`);
      console.log(`isVisible: ${video.isVisible}`);
      console.log(`hlsUrl: ${video.hlsUrl ? '✅ YES' : '❌ NO'}`);
      console.log(`thumbnailUrl: ${video.thumbnailUrl ? '✅ YES' : '❌ NO'}`);
      
      if (video.thumbnailUrl) {
        console.log(`thumbnailUrl: ${video.thumbnailUrl}`);
        
        // Extract S3 key from CloudFront URL
        const urlMatch = video.thumbnailUrl.match(/https:\/\/[^\/]+\/(.+)/);
        if (urlMatch) {
          const s3Key = urlMatch[1];
          console.log(`\n📦 Checking S3 for thumbnail: ${s3Key}`);
          
          try {
            await s3.headObject({
              Bucket: BUCKET_NAME,
              Key: s3Key
            }).promise();
            console.log(`   ✅ Thumbnail EXISTS in S3`);
          } catch (error) {
            if (error.code === 'NotFound') {
              console.log(`   ❌ Thumbnail NOT FOUND in S3!`);
              console.log(`   → This is why the video shows but has no thumbnail`);
            } else {
              console.log(`   ⚠️ Error checking S3: ${error.message}`);
            }
          }
        }
      }
      
      // Check if this might be a 15-minute stream (look for longer duration indicators)
      if (video.streamKey) {
        console.log(`\n🔍 Checking streamKey mapping for: ${video.streamKey}`);
        try {
          const streamKeyResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `STREAM_KEY#${video.streamKey}`,
              SK: 'MAPPING'
            }
          }).promise();
          
          if (streamKeyResult.Item) {
            console.log(`   ✅ StreamKey mapping found`);
            console.log(`   channelName: ${streamKeyResult.Item.channelName || 'N/A'}`);
            console.log(`   collaboratorEmail: ${streamKeyResult.Item.collaboratorEmail || 'N/A'}`);
            console.log(`   ownerEmail: ${streamKeyResult.Item.ownerEmail || 'N/A'}`);
          } else {
            console.log(`   ⚠️ StreamKey mapping NOT FOUND`);
          }
        } catch (error) {
          console.log(`   ❌ Error checking streamKey: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  }
}

check15MinStream().catch(console.error);
