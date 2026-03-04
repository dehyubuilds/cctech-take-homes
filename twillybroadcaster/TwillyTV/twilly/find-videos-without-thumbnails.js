const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findVideosWithoutThumbnails() {
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
    
    // Check each video for invalid thumbnails
    const videosWithoutThumbnails = [];
    
    for (const video of videos) {
      const thumbnailUrl = video.thumbnailUrl;
      
      // Comprehensive validation (same as backend filter)
      let hasValidThumbnail = false;
      
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
                hasValidThumbnail = true;
              }
            } catch (e) {
              // Invalid URL
            }
          }
        }
      }
      
      if (!hasValidThumbnail) {
        videosWithoutThumbnails.push(video);
        console.log(`❌ Video without valid thumbnail:`);
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
    console.log(`   Videos without valid thumbnails: ${videosWithoutThumbnails.length}`);
    
    if (videosWithoutThumbnails.length > 0) {
      console.log(`\n🗑️  Videos to delete/update:`);
      videosWithoutThumbnails.forEach((video, index) => {
        console.log(`   ${index + 1}. ${video.fileName || video.SK} (SK: ${video.SK})`);
      });
      
      // Ask if user wants to delete them
      console.log(`\n⚠️  These videos should be deleted or have isVisible set to false.`);
      console.log(`   They are appearing in all accounts because they pass through the filter.`);
    }
    
    return videosWithoutThumbnails;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

findVideosWithoutThumbnails().catch(console.error);
