import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkStreamKeyMapping(streamKey) {
  try {
    console.log(`🔍 Checking streamKey mapping for: ${streamKey}`);
    
    const result = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    }).promise();
    
    if (result.Item) {
      console.log(`✅ StreamKey mapping found:`);
      console.log(`   PK: ${result.Item.PK}`);
      console.log(`   SK: ${result.Item.SK}`);
      console.log(`   userEmail: ${result.Item.userEmail || 'NOT SET'}`);
      console.log(`   userId: ${result.Item.userId || 'NOT SET'}`);
      console.log(`   isPrivateUsername: ${JSON.stringify(result.Item.isPrivateUsername)} (type: ${typeof result.Item.isPrivateUsername})`);
      console.log(`   updatedAt: ${result.Item.updatedAt || 'NOT SET'}`);
      
      // Check the video entry
      const videoResult = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${result.Item.userEmail}`,
          ':sk': 'FILE#'
        },
        FilterExpression: 'streamKey = :streamKey',
        ExpressionAttributeValues: {
          ':pk': `USER#${result.Item.userEmail}`,
          ':sk': 'FILE#',
          ':streamKey': streamKey
        },
        Limit: 5,
        ScanIndexForward: false
      }).promise();
      
      if (videoResult.Items && videoResult.Items.length > 0) {
        console.log(`\n📹 Found ${videoResult.Items.length} video(s) for this streamKey:`);
        videoResult.Items.forEach((item, idx) => {
          console.log(`   [${idx + 1}] ${item.fileName || 'NO FILENAME'}`);
          console.log(`       SK: ${item.SK}`);
          console.log(`       isPrivateUsername: ${JSON.stringify(item.isPrivateUsername)} (type: ${typeof item.isPrivateUsername})`);
          console.log(`       createdAt: ${item.createdAt || 'NOT SET'}`);
        });
      } else {
        console.log(`\n⚠️ No videos found for this streamKey`);
      }
    } else {
      console.log(`❌ StreamKey mapping not found`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Get streamKey from command line argument
const streamKey = process.argv[2];
if (!streamKey) {
  console.error('Usage: node check-stream-key-mapping.js <streamKey>');
  process.exit(1);
}

checkStreamKeyMapping(streamKey);
