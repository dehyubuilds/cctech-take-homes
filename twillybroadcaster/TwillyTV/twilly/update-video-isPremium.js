const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function updateVideoIsPremium(streamKey) {
  console.log(`🔍 Updating isPremium for videos with streamKey: ${streamKey}\n`);
  
  // Get stream key mapping
  const mappingResult = await dynamodb.get({
    TableName: table,
    Key: {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING'
    }
  }).promise();
  
  if (!mappingResult.Item) {
    console.log(`❌ No stream key mapping found for: ${streamKey}`);
    return;
  }
  
  const isPremium = mappingResult.Item.isPremium === true;
  console.log(`✅ Stream key mapping has isPremium: ${isPremium}`);
  console.log(`   Mapping updatedAt: ${mappingResult.Item.updatedAt}\n`);
  
  // Find all video entries with this streamKey
  const scanResult = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'streamKey = :streamKey',
    ExpressionAttributeValues: {
      ':streamKey': streamKey
    }
  }).promise();
  
  if (!scanResult.Items || scanResult.Items.length === 0) {
    console.log(`❌ No video entries found with streamKey: ${streamKey}`);
    return;
  }
  
  console.log(`✅ Found ${scanResult.Items.length} video entry(ies) with this streamKey\n`);
  
  for (const video of scanResult.Items) {
    // Skip if it's not a FILE entry
    if (!video.SK || !video.SK.startsWith('FILE#')) {
      console.log(`⚠️  Skipping non-FILE entry: ${video.SK}`);
      continue;
    }
    
    const currentIsPremium = video.isPremium;
    const needsUpdate = currentIsPremium !== isPremium;
    
    console.log(`📹 Video: ${video.SK}`);
    console.log(`   Current isPremium: ${currentIsPremium} (type: ${typeof currentIsPremium})`);
    console.log(`   Should be: ${isPremium}`);
    console.log(`   Needs update: ${needsUpdate}`);
    
    if (needsUpdate) {
      try {
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: video.PK,
            SK: video.SK
          },
          UpdateExpression: 'SET isPremium = :isPremium, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':isPremium': isPremium,
            ':updatedAt': new Date().toISOString()
          }
        }).promise();
        console.log(`   ✅ Updated isPremium to ${isPremium}\n`);
      } catch (error) {
        console.log(`   ❌ Failed to update: ${error.message}\n`);
      }
    } else {
      console.log(`   ✅ Already correct, no update needed\n`);
    }
  }
  
  console.log('✅ Update complete!');
}

// Get streamKey from command line or use default
const streamKey = process.argv[2] || 'sk_rrpls34e8m4t8g42';

updateVideoIsPremium(streamKey).catch(console.error);
