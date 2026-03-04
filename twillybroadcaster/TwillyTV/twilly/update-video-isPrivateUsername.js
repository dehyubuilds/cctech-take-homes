import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function updateVideoIsPrivateUsername(fileId, streamKey) {
  try {
    console.log(`🔍 Updating video ${fileId} for streamKey ${streamKey}...`);
    
    // First, check the streamKey mapping
    const mappingResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    }).promise();
    
    if (!mappingResult.Item) {
      console.log(`❌ StreamKey mapping not found for ${streamKey}`);
      return;
    }
    
    const isPrivateUsername = mappingResult.Item.isPrivateUsername === true || 
                              mappingResult.Item.isPrivateUsername === 'true' || 
                              mappingResult.Item.isPrivateUsername === 1;
    
    console.log(`📝 StreamKey mapping has isPrivateUsername: ${isPrivateUsername}`);
    
    // Update the video entry
    const adminEmail = 'dehyu.sinyan@gmail.com';
    const updateParams = {
      TableName: table,
      Key: {
        PK: `USER#${adminEmail}`,
        SK: `FILE#${fileId}`
      },
      UpdateExpression: 'SET isPrivateUsername = :isPrivate',
      ExpressionAttributeValues: {
        ':isPrivate': isPrivateUsername
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamodb.update(updateParams).promise();
    console.log(`✅ Updated video entry:`);
    console.log(`   FileId: ${fileId}`);
    console.log(`   isPrivateUsername: ${result.Attributes.isPrivateUsername}`);
    
  } catch (error) {
    console.error(`❌ Error updating video:`, error);
  }
}

// Update the new video that was just streamed
const fileId = 'file-1770785836680-y9kenb6fm';
const streamKey = 'sk_rrpls34e8m4t8g42';

updateVideoIsPrivateUsername(fileId, streamKey);
