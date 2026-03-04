const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findOneSecondVideo() {
  console.log('🔍 Searching for 1-second videos in Twilly TV channel...\n');
  
  try {
    // Query for all videos in Twilly TV channel
    const result = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: '(folderName = :channelName OR seriesName = :channelName) AND category = :category',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FILE#',
        ':channelName': 'Twilly TV',
        ':category': 'Videos'
      }
    }).promise();
    
    console.log(`Found ${result.Items?.length || 0} videos in Twilly TV channel\n`);
    
    if (result.Items && result.Items.length > 0) {
      // Look for videos with no thumbnail or suspicious patterns
      const suspiciousVideos = result.Items.filter(item => {
        const hasThumbnail = item.thumbnailUrl && 
                            typeof item.thumbnailUrl === 'string' && 
                            item.thumbnailUrl.trim() !== '' &&
                            (item.thumbnailUrl.startsWith('http://') || item.thumbnailUrl.startsWith('https://'));
        
        // Check if thumbnail is missing or invalid
        if (!hasThumbnail) {
          return true;
        }
        
        // Check for test patterns in fileName
        const fileName = (item.fileName || '').toLowerCase();
        if (fileName.includes('test') || fileName.includes('sample') || fileName.includes('1s') || fileName.includes('1sec')) {
          return true;
        }
        
        return false;
      });
      
      console.log(`Found ${suspiciousVideos.length} suspicious videos (no thumbnail or test patterns):\n`);
      
      suspiciousVideos.forEach((video, index) => {
        console.log(`[${index + 1}] ${video.fileName || 'N/A'}`);
        console.log(`   SK: ${video.SK}`);
        console.log(`   StreamKey: ${video.streamKey || 'MISSING'}`);
        console.log(`   ThumbnailUrl: ${video.thumbnailUrl || 'MISSING'} (type: ${typeof video.thumbnailUrl})`);
        console.log(`   HlsUrl: ${video.hlsUrl ? 'PRESENT' : 'MISSING'}`);
        console.log(`   FolderName: ${video.folderName || 'MISSING'}`);
        console.log(`   SeriesName: ${video.seriesName || 'MISSING'}`);
        console.log(`   IsVisible: ${video.isVisible}`);
        console.log(`   CreatedAt: ${video.createdAt || video.timestamp || 'MISSING'}`);
        console.log('');
      });
      
      // Also check all videos to see their thumbnail status
      console.log('\n📊 All videos thumbnail status:\n');
      result.Items.forEach((video, index) => {
        const hasThumbnail = video.thumbnailUrl && 
                            typeof video.thumbnailUrl === 'string' && 
                            video.thumbnailUrl.trim() !== '' &&
                            (video.thumbnailUrl.startsWith('http://') || video.thumbnailUrl.startsWith('https://'));
        
        console.log(`[${index + 1}] ${video.fileName || 'N/A'}`);
        console.log(`   StreamKey: ${video.streamKey || 'MISSING'}`);
        console.log(`   HasThumbnail: ${hasThumbnail ? 'YES' : 'NO'}`);
        console.log(`   ThumbnailUrl: ${video.thumbnailUrl || 'MISSING'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findOneSecondVideo().catch(console.error);
