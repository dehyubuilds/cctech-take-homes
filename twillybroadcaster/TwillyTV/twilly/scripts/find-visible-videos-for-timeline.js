const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findVisibleVideos() {
  const userEmail = 'dehyu.sinyan@gmail.com'; // Twilly TV
  const pk = `USER#${userEmail}`;
  
  console.log(`🔍 Finding visible videos for ${userEmail}...\n`);
  
  // Get all videos from this user
  const params = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    FilterExpression: '#category = :category',
    ExpressionAttributeNames: {
      '#category': 'category'
    },
    ExpressionAttributeValues: {
      ':pk': pk,
      ':sk': 'FILE#',
      ':category': 'Videos'
    },
    Limit: 20,
    ScanIndexForward: false
  };
  
  const result = await dynamodb.query(params).promise();
  const videos = result.Items || [];
  
  console.log(`📊 Found ${videos.length} videos:\n`);
  
  // Show all videos with their details
  videos.forEach((video, idx) => {
    const fileId = video.SK.replace('FILE#', '');
    const isVisible = video.isVisible !== false; // Default to true if not set
    const isPrivate = video.isPrivateUsername === true;
    const creatorUsername = video.creatorUsername || 'N/A';
    
    console.log(`[${idx + 1}] ${video.fileName || fileId}`);
    console.log(`   File ID: ${fileId}`);
    console.log(`   Creator: ${creatorUsername}`);
    console.log(`   isVisible: ${isVisible}`);
    console.log(`   isPrivateUsername: ${isPrivate}`);
    console.log(`   Category: ${video.category || 'N/A'}`);
    console.log(`   Thumbnail: ${video.thumbnailUrl ? 'YES' : 'NO'}`);
    console.log();
  });
  
  // Find the best candidate - one that's visible, has thumbnail, and is recent
  const bestVideo = videos.find(v => 
    v.isVisible !== false && 
    v.thumbnailUrl && 
    (v.creatorUsername || v.fileName)
  ) || videos[0];
  
  if (bestVideo) {
    const fileId = bestVideo.SK.replace('FILE#', '');
    console.log('='.repeat(60));
    console.log(`✅ BEST CANDIDATE:`);
    console.log(`   File ID: ${fileId}`);
    console.log(`   File Name: ${bestVideo.fileName || fileId}`);
    console.log(`   Creator: ${bestVideo.creatorUsername || 'N/A'}`);
    console.log(`   isVisible: ${bestVideo.isVisible !== false}`);
    console.log(`   Has Thumbnail: ${bestVideo.thumbnailUrl ? 'YES' : 'NO'}`);
    console.log('='.repeat(60));
    return fileId;
  }
  
  return null;
}

findVisibleVideos()
  .then((videoId) => {
    if (videoId) {
      console.log(`\n✅ Use this video ID: ${videoId}`);
    } else {
      console.log('\n❌ No suitable video found');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
