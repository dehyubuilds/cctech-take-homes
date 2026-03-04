const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixMissingCreatorId() {
  const streamKey = 'twillytvdur4k9l2';
  const nonAdminEmail = 'dehyubuilds@gmail.com';
  
  console.log(`🔍 Fixing missing creatorId for streamKey: ${streamKey}\n`);
  
  // Get the streamKey mapping
  const mapping = await dynamodb.get({
    TableName: table,
    Key: {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING'
    }
  }).promise();
  
  if (!mapping.Item) {
    console.log('❌ StreamKey mapping not found!');
    return;
  }
  
  console.log('Current mapping:');
  console.log(`   collaboratorEmail: ${mapping.Item.collaboratorEmail || 'N/A'}`);
  console.log(`   creatorId: ${mapping.Item.creatorId || 'N/A'}`);
  console.log(`   channelName: ${mapping.Item.channelName || 'N/A'}`);
  
  // Find userId from user profile
  console.log('\n🔍 Finding userId for email:', nonAdminEmail);
  
  // Try to find user by email
  const userScan = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND email = :email',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':email': nonAdminEmail
    }
  }).promise();
  
  let userId = null;
  if (userScan.Items && userScan.Items.length > 0) {
    // Try to find userId in the items
    for (const item of userScan.Items) {
      if (item.userId) {
        userId = item.userId;
        break;
      }
      // Check if PK contains userId (format: USER#userId)
      const pkParts = item.PK.split('#');
      if (pkParts.length > 1 && pkParts[1] !== nonAdminEmail) {
        // Might be userId
        userId = pkParts[1];
        break;
      }
    }
  }
  
  // Also check COLLABORATOR_ROLE records
  if (!userId) {
    const collabScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND userEmail = :email',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':email': nonAdminEmail
      }
    }).promise();
    
    if (collabScan.Items && collabScan.Items.length > 0) {
      // Extract userId from PK (format: USER#userId)
      const pk = collabScan.Items[0].PK;
      if (pk && pk.startsWith('USER#')) {
        userId = pk.replace('USER#', '');
      }
    }
  }
  
  if (userId) {
    console.log(`✅ Found userId: ${userId}`);
    console.log(`\n📝 Updating streamKey mapping with creatorId...`);
    
    await dynamodb.update({
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      },
      UpdateExpression: 'SET creatorId = :creatorId',
      ExpressionAttributeValues: {
        ':creatorId': userId
      }
    }).promise();
    
    console.log(`✅ Updated streamKey mapping with creatorId: ${userId}`);
  } else {
    console.log(`⚠️ Could not find userId for ${nonAdminEmail}`);
    console.log(`   StreamKey mapping will remain without creatorId`);
  }
}

fixMissingCreatorId().catch(console.error);
