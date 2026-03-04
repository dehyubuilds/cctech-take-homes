const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findExistingVideo() {
  console.log('🔍 Finding an existing video from Twilly TV account...\n');
  
  const email = 'dehyu.sinyan@gmail.com';
  const pk = `USER#${email}`;
  
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
    Limit: 5,
    ScanIndexForward: false
  };
  
  const result = await dynamodb.query(params).promise();
  
  if (result.Items && result.Items.length > 0) {
    console.log(`✅ Found ${result.Items.length} video(s):\n`);
    result.Items.forEach((video, idx) => {
      const fileId = video.SK.replace('FILE#', '');
      console.log(`[${idx + 1}] ${video.fileName || fileId}`);
      console.log(`   SK: ${video.SK}`);
      console.log(`   File ID: ${fileId}`);
      console.log(`   Creator: ${video.creatorUsername || 'N/A'}`);
      console.log(`   Category: ${video.category || 'N/A'}`);
      console.log();
    });
    
    return result.Items[0];
  } else {
    console.log('❌ No videos found');
    return null;
  }
}

findExistingVideo()
  .then((video) => {
    if (video) {
      const fileId = video.SK.replace('FILE#', '');
      console.log(`\n✅ Use this video ID for testing: ${fileId}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
