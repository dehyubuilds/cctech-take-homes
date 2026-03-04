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

async function cleanupVideosWithoutThumbnails() {
  console.log('🔍 Searching for videos without valid thumbnails in Twilly TV channel...\n');
  
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
    
    // Check each video for invalid/broken thumbnails
    const videosToCleanup = [];
    
    for (const video of videos) {
      const thumbnailUrl = video.thumbnailUrl;
      
      // Step 1: Basic validation (same as backend filter)
      let hasValidThumbnailFormat = false;
      
      if (thumbnailUrl) {
        if (typeof thumbnailUrl === 'string') {
          const trimmed = thumbnailUrl.trim();
          if (trimmed !== '' && 
              trimmed !== 'null' && 
              trimmed !== 'undefined' &&
              trimmed !== 'None' &&
              trimmed !== 'none' &&
              !trimmed.startsWith('data:') &&
              (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
            try {
              const url = new URL(trimmed);
              if (url.hostname && url.pathname) {
                hasValidThumbnailFormat = true;
              }
            } catch (e) {
              // Invalid URL format
            }
          }
        }
      }
      
      // Step 2: Check if thumbnail file actually exists in S3
      let thumbnailExistsInS3 = false;
      if (hasValidThumbnailFormat) {
        try {
          // Extract S3 key from CloudFront URL
          const url = new URL(thumbnailUrl);
          let s3Key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
          
          // Check if file exists in S3
          try {
            await s3.headObject({ Bucket: BUCKET_NAME, Key: s3Key }).promise();
            thumbnailExistsInS3 = true;
          } catch (s3Error) {
            if (s3Error.code === 'NotFound' || s3Error.statusCode === 404) {
              // Thumbnail doesn't exist - this is a broken thumbnail
              thumbnailExistsInS3 = false;
            } else {
              // Other error - assume it exists to be safe
              thumbnailExistsInS3 = true;
            }
          }
        } catch (urlError) {
          // Invalid URL - already caught above
        }
      }
      
      // Video needs cleanup if: invalid format OR file doesn't exist in S3
      if (!hasValidThumbnailFormat || !thumbnailExistsInS3) {
        videosToCleanup.push(video);
        const reason = !hasValidThumbnailFormat ? 'invalid format' : 'file missing in S3';
        console.log(`❌ Video with broken thumbnail (${reason}):`);
        console.log(`   PK: ${video.PK}`);
        console.log(`   SK: ${video.SK}`);
        console.log(`   fileName: ${video.fileName || 'MISSING'}`);
        console.log(`   streamKey: ${video.streamKey || 'MISSING'}`);
        console.log(`   thumbnailUrl: ${JSON.stringify(thumbnailUrl)}`);
        console.log(`   createdAt: ${video.createdAt || video.timestamp || 'MISSING'}`);
        console.log(`   isVisible: ${video.isVisible}`);
        console.log('');
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total videos: ${videos.length}`);
    console.log(`   Videos without valid thumbnails: ${videosToCleanup.length}`);
    
    if (videosToCleanup.length > 0) {
      console.log(`\n🗑️  Deleting ${videosToCleanup.length} videos with broken thumbnails...`);
      
      for (const video of videosToCleanup) {
        try {
          // Permanently delete the video entry from DynamoDB
          const deleteParams = {
            TableName: table,
            Key: {
              PK: video.PK,
              SK: video.SK
            }
          };
          
          await dynamodb.delete(deleteParams).promise();
          console.log(`✅ Deleted: ${video.fileName || video.SK}`);
        } catch (error) {
          console.error(`❌ Failed to delete ${video.SK}: ${error.message}`);
        }
      }
      
      console.log(`\n✅ Cleanup complete! ${videosToCleanup.length} videos permanently deleted`);
    } else {
      console.log(`\n✅ No videos to clean up - all videos have valid thumbnails`);
    }
    
    return videosToCleanup;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

cleanupVideosWithoutThumbnails().catch(console.error);
