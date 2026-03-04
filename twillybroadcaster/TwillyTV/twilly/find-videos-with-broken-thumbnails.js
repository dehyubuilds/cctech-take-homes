const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const table = 'Twilly';
const BUCKET_NAME = 'twillybroadcaster';

async function findVideosWithBrokenThumbnails() {
  console.log('🔍 Searching for videos with broken thumbnail URLs in Twilly TV channel...\n');
  
  try {
    // Find all videos in Twilly TV channel
    const videos = [];
    let lastEvaluatedKey = null;
    
    do {
      const params = {
        TableName: table,
        FilterExpression: 'category = :category AND (folderName = :channelName OR seriesName = :channelName)',
        ExpressionAttributeValues: {
          ':category': 'Videos',
          ':channelName': 'Twilly TV'
        }
      };
      
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamodb.scan(params).promise();
      
      if (result.Items) {
        videos.push(...result.Items);
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`Found ${videos.length} total videos in Twilly TV channel\n`);
    
    // Check each video for broken thumbnails
    const videosWithBrokenThumbnails = [];
    
    for (const video of videos) {
      const thumbnailUrl = video.thumbnailUrl;
      
      if (!thumbnailUrl || typeof thumbnailUrl !== 'string') {
        continue; // Already filtered by other script
      }
      
      // Extract S3 key from CloudFront URL
      // Format: https://d4idc5cmwxlpy.cloudfront.net/clips/{streamKey}/{uploadId}/{prefix}_thumb.jpg
      // Or: https://d4idc5cmwxlpy.cloudfront.net/clips/{streamKey}/{prefix}_thumb.jpg
      let s3Key = null;
      try {
        const url = new URL(thumbnailUrl);
        // Remove leading slash from pathname
        s3Key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
      } catch (e) {
        console.log(`⚠️ Invalid URL format: ${thumbnailUrl}`);
        continue;
      }
      
      // Check if file exists in S3
      try {
        await s3.headObject({ Bucket: BUCKET_NAME, Key: s3Key }).promise();
        // File exists - thumbnail is valid
      } catch (s3Error) {
        if (s3Error.code === 'NotFound' || s3Error.statusCode === 404) {
          // Thumbnail file doesn't exist in S3 - this is a broken thumbnail
          videosWithBrokenThumbnails.push({
            video,
            s3Key,
            thumbnailUrl
          });
          console.log(`❌ Video with broken thumbnail (file doesn't exist in S3):`);
          console.log(`   SK: ${video.SK}`);
          console.log(`   fileName: ${video.fileName || 'MISSING'}`);
          console.log(`   streamKey: ${video.streamKey || 'MISSING'}`);
          console.log(`   thumbnailUrl: ${thumbnailUrl}`);
          console.log(`   S3 Key: ${s3Key}`);
          console.log(`   createdAt: ${video.createdAt || video.timestamp || 'MISSING'}`);
          console.log(`   isVisible: ${video.isVisible}`);
          console.log('');
        } else {
          console.log(`⚠️ Error checking S3 for ${s3Key}: ${s3Error.message}`);
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total videos: ${videos.length}`);
    console.log(`   Videos with broken thumbnails (file doesn't exist in S3): ${videosWithBrokenThumbnails.length}`);
    
    if (videosWithBrokenThumbnails.length > 0) {
      console.log(`\n🗑️  Videos to clean up:`);
      videosWithBrokenThumbnails.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.video.fileName || item.video.SK} (SK: ${item.video.SK})`);
        console.log(`      S3 Key: ${item.s3Key}`);
      });
      
      console.log(`\n⚠️  These videos have thumbnail URLs but the files don't exist in S3.`);
      console.log(`   They should be hidden (isVisible=false) or deleted.`);
    }
    
    return videosWithBrokenThumbnails;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

findVideosWithBrokenThumbnails().catch(console.error);
