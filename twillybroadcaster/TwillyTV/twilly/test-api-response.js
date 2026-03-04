import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function testAPIResponse() {
  try {
    // Simulate what the API does
    const adminEmail = 'dehyu.sinyan@gmail.com';
    const result = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${adminEmail}`,
        ':sk': 'FILE#'
      },
      FilterExpression: 'folderName = :folderName',
      ExpressionAttributeValues: {
        ':pk': `USER#${adminEmail}`,
        ':sk': 'FILE#',
        ':folderName': 'Twilly TV'
      },
      Limit: 10,
      ScanIndexForward: false
    }).promise();
    
    console.log(`Found ${result.Items.length} items`);
    
    result.Items.forEach((item, index) => {
      console.log(`\n[${index + 1}] ${item.fileName || item.SK}`);
      console.log(`   isPrivateUsername: ${item.isPrivateUsername} (type: ${typeof item.isPrivateUsername})`);
      console.log(`   streamKey: ${item.streamKey}`);
      
      // Check if it's the video we're looking for
      if (item.fileName && item.fileName.includes('zagd8k9g')) {
        console.log(`   ✅ THIS IS THE VIDEO WE'RE LOOKING FOR`);
        console.log(`   Full item keys: ${Object.keys(item).join(', ')}`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPIResponse();
