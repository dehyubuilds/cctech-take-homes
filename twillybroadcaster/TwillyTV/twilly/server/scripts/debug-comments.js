const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugComments() {
  // The videoId from the logs
  const videoId = 'sk_rrpls34e8m4t8g42_2026-02-25T18-23-57-558Z_f01agnv4_master.m3u8';
  const normalizedVideoId = videoId.startsWith('FILE#') ? videoId.replace('FILE#', '') : videoId;
  
  console.log(`🔍 Debugging comments for videoId: ${videoId}`);
  console.log(`   Normalized: ${normalizedVideoId}`);
  console.log(`   PK will be: VIDEO#${normalizedVideoId}`);
  
  // Try to find comments with the expected PK
  const params = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `VIDEO#${normalizedVideoId}`,
      ':sk': 'COMMENT#'
    },
    ConsistentRead: true
  };
  
  console.log('\n📊 Querying with params:', JSON.stringify(params, null, 2));
  
  try {
    const result = await dynamodb.query(params).promise();
    console.log(`\n✅ Found ${result.Items?.length || 0} comments with PK: VIDEO#${normalizedVideoId}`);
    
    if (result.Items && result.Items.length > 0) {
      console.log('\n📝 Comments found:');
      result.Items.forEach((item, index) => {
        console.log(`\n   Comment ${index + 1}:`);
        console.log(`     PK: ${item.PK}`);
        console.log(`     SK: ${item.SK}`);
        console.log(`     commentId: ${item.commentId}`);
        console.log(`     videoId: ${item.videoId}`);
        console.log(`     userId: ${item.userId}`);
        console.log(`     username: ${item.username}`);
        console.log(`     text: ${item.text?.substring(0, 50)}...`);
        console.log(`     isPrivate: ${item.isPrivate}`);
        console.log(`     parentCommentId: ${item.parentCommentId}`);
        console.log(`     visibleTo: ${JSON.stringify(item.visibleTo)}`);
      });
    } else {
      console.log('\n⚠️ No comments found with that PK. Let me search for any comments with this videoId...');
      
      // Try scanning for comments with this videoId
      const scanParams = {
        TableName: table,
        FilterExpression: 'videoId = :videoId',
        ExpressionAttributeValues: {
          ':videoId': videoId
        }
      };
      
      const scanResult = await dynamodb.scan(scanParams).promise();
      console.log(`\n🔍 Scan found ${scanResult.Items?.length || 0} items with videoId: ${videoId}`);
      
      if (scanResult.Items && scanResult.Items.length > 0) {
        console.log('\n📝 Items found (showing PK/SK structure):');
        scanResult.Items.forEach((item, index) => {
          console.log(`\n   Item ${index + 1}:`);
          console.log(`     PK: ${item.PK}`);
          console.log(`     SK: ${item.SK}`);
          console.log(`     videoId: ${item.videoId}`);
          if (item.commentId) {
            console.log(`     commentId: ${item.commentId}`);
            console.log(`     username: ${item.username}`);
            console.log(`     text: ${item.text?.substring(0, 50)}...`);
          }
        });
      }
      
      // Also try searching for FILE# prefix
      const fileScanParams = {
        TableName: table,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: {
          ':sk': `FILE#${videoId}`
        }
      };
      
      const fileResult = await dynamodb.scan(fileScanParams).promise();
      console.log(`\n🔍 Found ${fileResult.Items?.length || 0} video entries with SK: FILE#${videoId}`);
      
      if (fileResult.Items && fileResult.Items.length > 0) {
        fileResult.Items.forEach((item, index) => {
          console.log(`\n   Video Entry ${index + 1}:`);
          console.log(`     PK: ${item.PK}`);
          console.log(`     SK: ${item.SK}`);
          console.log(`     isPrivateUsername: ${item.isPrivateUsername}`);
          console.log(`     isPremium: ${item.isPremium}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugComments().catch(console.error);
