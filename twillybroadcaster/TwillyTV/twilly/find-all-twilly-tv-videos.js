const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findAllTwillyTVVideos() {
  console.log('🔍 Searching for ALL videos that might appear in Twilly TV channel...\n');
  
  try {
    // Query for all videos from master account
    const masterResult = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'category = :category',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FILE#',
        ':category': 'Videos'
      }
    }).promise();
    
    console.log(`Found ${masterResult.Items?.length || 0} videos from master account\n`);
    
    // Filter for Twilly TV videos (check both folderName and seriesName)
    const twillyTVVideos = (masterResult.Items || []).filter(item => {
      const folderName = item.folderName || '';
      const seriesName = item.seriesName || '';
      return folderName.toLowerCase().includes('twilly tv') || 
             seriesName.toLowerCase().includes('twilly tv') ||
             folderName === 'Twilly TV' ||
             seriesName === 'Twilly TV';
    });
    
    console.log(`Found ${twillyTVVideos.length} videos matching Twilly TV:\n`);
    
    twillyTVVideos.forEach((video, index) => {
      const thumbnailUrl = video.thumbnailUrl || '';
      const hasValidThumbnail = thumbnailUrl && 
                                typeof thumbnailUrl === 'string' && 
                                thumbnailUrl.trim() !== '' && 
                                thumbnailUrl !== 'null' && 
                                thumbnailUrl !== 'undefined' &&
                                (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://'));
      
      console.log(`[${index + 1}] ${video.fileName || 'N/A'}`);
      console.log(`   SK: ${video.SK}`);
      console.log(`   StreamKey: ${video.streamKey || 'MISSING'}`);
      console.log(`   FolderName: ${video.folderName || 'MISSING'}`);
      console.log(`   SeriesName: ${video.seriesName || 'MISSING'}`);
      console.log(`   HasValidThumbnail: ${hasValidThumbnail ? 'YES' : 'NO'}`);
      console.log(`   ThumbnailUrl: ${thumbnailUrl || 'MISSING'} (type: ${typeof thumbnailUrl})`);
      console.log(`   HlsUrl: ${video.hlsUrl ? 'PRESENT' : 'MISSING'}`);
      console.log(`   IsVisible: ${video.isVisible}`);
      console.log(`   IsCollaboratorVideo: ${video.isCollaboratorVideo}`);
      console.log(`   CreatedAt: ${video.createdAt || video.timestamp || 'MISSING'}`);
      console.log('');
    });
    
    // Find videos with no thumbnail
    const noThumbnailVideos = twillyTVVideos.filter(video => {
      const thumbnailUrl = video.thumbnailUrl || '';
      const hasValidThumbnail = thumbnailUrl && 
                                typeof thumbnailUrl === 'string' && 
                                thumbnailUrl.trim() !== '' && 
                                thumbnailUrl !== 'null' && 
                                thumbnailUrl !== 'undefined' &&
                                (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://'));
      return !hasValidThumbnail;
    });
    
    if (noThumbnailVideos.length > 0) {
      console.log(`\n🚫 Found ${noThumbnailVideos.length} videos with NO VALID THUMBNAIL:\n`);
      noThumbnailVideos.forEach((video, index) => {
        console.log(`[${index + 1}] ${video.fileName || 'N/A'}`);
        console.log(`   StreamKey: ${video.streamKey || 'MISSING'}`);
        console.log(`   ThumbnailUrl: ${JSON.stringify(video.thumbnailUrl)}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findAllTwillyTVVideos().catch(console.error);
