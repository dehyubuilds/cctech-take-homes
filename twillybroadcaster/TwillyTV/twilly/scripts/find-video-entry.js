const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findVideoEntry() {
  const videoId = 'file-upload-1768146193473-vfjgo9s';
  
  console.log(`🔍 Finding video entry for: ${videoId}\n`);
  
  // Try different SK formats
  const skFormats = [
    `FILE#${videoId}`,
    videoId,
    `FILE#file-upload-1768146193473-vfjgo9s`
  ];
  
  for (const sk of skFormats) {
    console.log(`📋 Trying SK: ${sk}`);
    
    const scanParams = {
      TableName: table,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':sk': sk
      },
      Limit: 5
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    
    if (result.Items && result.Items.length > 0) {
      console.log(`✅ Found ${result.Items.length} entry(ies):\n`);
      result.Items.forEach((item, idx) => {
        console.log(`   [${idx + 1}]`);
        console.log(`   PK: ${item.PK}`);
        console.log(`   SK: ${item.SK}`);
        console.log(`   fileName: ${item.fileName || 'N/A'}`);
        console.log(`   creatorUsername: ${item.creatorUsername || 'N/A'}`);
        console.log();
      });
      return result.Items[0];
    } else {
      console.log(`   ❌ Not found\n`);
    }
  }
  
  // Also try querying by VIDEO# prefix for comments
  console.log(`📋 Checking comments with PK: VIDEO#${videoId}`);
  const commentParams = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `VIDEO#${videoId}`,
      ':sk': 'COMMENT#'
    },
    Limit: 1
  };
  
  const commentResult = await dynamodb.query(commentParams).promise();
  if (commentResult.Items && commentResult.Items.length > 0) {
    console.log(`✅ Found comments with this videoId\n`);
  } else {
    console.log(`❌ No comments found with this videoId\n`);
  }
}

findVideoEntry()
  .then(() => {
    console.log('✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
