const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function testStreamKeyScan() {
  console.log('🔍 Testing streamKey scan for creatorId...\n');

  const creatorId = 'f6ff9d4d-fb19-425c-94cb-617a9ee6f7fc';

  // Try the scan
  try {
    const streamKeyScanParams = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND creatorId = :creatorId',
      ExpressionAttributeValues: {
        ':pkPrefix': 'STREAM_KEY#',
        ':sk': 'MAPPING',
        ':creatorId': creatorId
      },
      Limit: 10
    };
    
    console.log('Scan params:', JSON.stringify(streamKeyScanParams, null, 2));
    
    const streamKeyScanResult = await dynamodb.scan(streamKeyScanParams).promise();
    
    console.log(`\nResults: ${streamKeyScanResult.Items ? streamKeyScanResult.Items.length : 0} items found`);
    
    if (streamKeyScanResult.Items && streamKeyScanResult.Items.length > 0) {
      streamKeyScanResult.Items.forEach((item, idx) => {
        console.log(`\n[${idx + 1}] StreamKey mapping:`);
        console.log(`   PK: ${item.PK}`);
        console.log(`   SK: ${item.SK}`);
        console.log(`   creatorId: ${item.creatorId}`);
        console.log(`   collaboratorEmail: ${item.collaboratorEmail || 'N/A'}`);
        console.log(`   ownerEmail: ${item.ownerEmail || 'N/A'}`);
        console.log(`   channelName: ${item.channelName || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️ No items found');
      
      // Try a broader scan to see what we have
      console.log('\nTrying broader scan to see all STREAM_KEY#MAPPING items...');
      const broadScan = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pkPrefix': 'STREAM_KEY#',
          ':sk': 'MAPPING'
        },
        Limit: 5
      }).promise();
      
      if (broadScan.Items && broadScan.Items.length > 0) {
        console.log(`Found ${broadScan.Items.length} streamKey mappings (showing first 5):`);
        broadScan.Items.forEach((item, idx) => {
          console.log(`   [${idx + 1}] ${item.PK}: creatorId=${item.creatorId || 'N/A'}, collaboratorEmail=${item.collaboratorEmail || 'N/A'}`);
        });
      }
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error);
  }

  console.log('\n✅ Test complete!');
}

testStreamKeyScan().catch(console.error);
