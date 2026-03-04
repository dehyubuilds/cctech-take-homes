// Simple script to check recent DynamoDB entries
// Run with: node check-dynamodb-recent.js
// Requires: AWS credentials configured or in environment

// Try to use AWS SDK if available, otherwise provide instructions
let AWS;
try {
  AWS = require('aws-sdk');
} catch (e) {
  console.log('❌ aws-sdk not found. Please run this on the EC2 server or install:');
  console.log('   npm install aws-sdk');
  console.log('');
  console.log('Alternatively, use AWS CLI:');
  console.log('   aws dynamodb query --table-name Twilly \\');
  console.log('     --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \\');
  console.log('     --expression-attribute-values \'{"::pk":{"S":"USER#dehyu.sinyan@gmail.com"},":sk":{"S":"FILE#"}}\' \\');
  console.log('     --limit 10 --scan-index-forward false --region us-east-1');
  process.exit(1);
}

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function checkRecentVideos() {
  try {
    console.log('🔍 Checking most recent videos in DynamoDB...\n');
    
    const params = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FILE#'
      },
      Limit: 15,
      ScanIndexForward: false
    };
    
    const result = await dynamodb.query(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No videos found');
      return;
    }
    
    console.log(`✅ Found ${result.Items.length} recent videos\n`);
    console.log('='.repeat(100));
    
    result.Items.forEach((item, index) => {
      console.log(`\n📹 Video #${index + 1}:`);
      console.log(`   FileId: ${item.fileId || item.SK?.replace('FILE#', '') || 'N/A'}`);
      console.log(`   FileName: ${item.fileName || 'N/A'}`);
      console.log(`   StreamKey: ${item.streamKey || 'N/A'}`);
      console.log(`   UploadId: ${item.uploadId || 'N/A'}`);
      console.log(`   Created: ${item.createdAt || item.timestamp || 'N/A'}`);
      console.log(`   Folder: ${item.folderName || item.folderPath || 'N/A'}`);
      console.log(`   Is Visible: ${item.isVisible !== false ? '✅ YES' : '❌ NO'}`);
      console.log(`   Thumbnail: ${item.thumbnailUrl ? '✅ YES' : '❌ NO'}`);
      if (item.thumbnailUrl) {
        console.log(`   Thumbnail URL: ${item.thumbnailUrl.substring(0, 80)}...`);
      }
      console.log(`   HLS URL: ${item.hlsUrl || item.url || 'N/A'}`);
      console.log(`   Creator: ${item.creatorUsername || item.creatorId || 'N/A'}`);
      console.log(`   Streamer: ${item.streamerEmail || 'N/A'}`);
      console.log(`   Is Private: ${item.isPrivateUsername ? 'YES' : 'NO'}`);
      
      // Check if this might be the 15-minute video
      if (item.fileName && item.fileName.includes('master.m3u8')) {
        console.log(`   ⚠️  This is an HLS master playlist - check S3 for actual video files`);
      }
      
      console.log('-'.repeat(100));
    });
    
    // Check for videos that might be hidden
    const hiddenVideos = result.Items.filter(item => item.isVisible === false);
    if (hiddenVideos.length > 0) {
      console.log(`\n⚠️  Found ${hiddenVideos.length} videos with isVisible: false`);
      hiddenVideos.forEach(item => {
        console.log(`   - ${item.fileName || item.SK} (Created: ${item.createdAt || item.timestamp})`);
      });
    }
    
    // Check for videos without thumbnails
    const noThumbnail = result.Items.filter(item => !item.thumbnailUrl);
    if (noThumbnail.length > 0) {
      console.log(`\n⚠️  Found ${noThumbnail.length} videos without thumbnails (upload might have failed)`);
      noThumbnail.forEach(item => {
        console.log(`   - ${item.fileName || item.SK} (Created: ${item.createdAt || item.timestamp})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking videos:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkRecentVideos()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
