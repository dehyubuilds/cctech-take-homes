const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixLatestStream() {
  console.log('🔧 Fixing latest stream username...\n');

  const streamKey = 'tacotuesdaydv7dny7c';
  const testUsername = 'yess';
  const testEmail = 'dehyubuilds@gmail.com';

  // Find userId from email
  console.log(`🔍 Finding userId for email: ${testEmail}...`);
  
  let userId = null;
  try {
    // Try to find user by email
    const emailScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'email = :email OR userEmail = :email',
      ExpressionAttributeValues: {
        ':email': testEmail
      }
    }).promise();
    
    if (emailScan.Items && emailScan.Items.length > 0) {
      const user = emailScan.Items[0];
      userId = user.userId || user.id || user.PK?.replace('USER#', '');
      console.log(`✅ Found userId: ${userId}\n`);
    } else {
      // Try direct get
      const userGet = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `USER#${testEmail}`,
          SK: 'PROFILE'
        }
      }).promise();
      
      if (userGet.Item) {
        userId = userGet.Item.userId || userGet.Item.id;
        console.log(`✅ Found userId via direct get: ${userId}\n`);
      }
    }
  } catch (error) {
    console.error(`❌ Error finding userId: ${error.message}`);
  }

  if (!userId) {
    console.log(`⚠️ Could not find userId. Will try to get from streamKey mapping or create one.`);
  }

  // Update streamKey mapping
  console.log(`🔧 Updating streamKey mapping...`);
  try {
    const currentMapping = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    }).promise();

    if (currentMapping.Item) {
      console.log(`   Current mapping:`);
      console.log(`     collaboratorEmail: ${currentMapping.Item.collaboratorEmail || 'N/A'}`);
      console.log(`     creatorId: ${currentMapping.Item.creatorId || 'N/A'}`);
      
      const updateParams = {
        TableName: table,
        Key: {
          PK: `STREAM_KEY#${streamKey}`,
          SK: 'MAPPING'
        },
        UpdateExpression: 'SET creatorId = :creatorId',
        ExpressionAttributeValues: {
          ':creatorId': userId || 'unknown'
        }
      };
      
      if (userId) {
        await dynamodb.update(updateParams).promise();
        console.log(`   ✅ Updated creatorId to: ${userId}\n`);
      } else {
        console.log(`   ⚠️ Cannot update - userId not found\n`);
      }
    } else {
      console.log(`   ❌ StreamKey mapping not found\n`);
    }
  } catch (error) {
    console.error(`❌ Error updating streamKey mapping: ${error.message}`);
  }

  // Update user profile with username
  if (userId) {
    console.log(`🔧 Updating user profile with username "${testUsername}"...`);
    try {
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE'
        },
        UpdateExpression: 'SET username = :username, userName = :username, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':username': testUsername,
          ':updatedAt': new Date().toISOString()
        }
      }).promise();
      console.log(`   ✅ Username updated to "${testUsername}"\n`);
    } catch (error) {
      console.error(`❌ Error updating username: ${error.message}`);
    }
  }

  console.log('✅ Fix complete!');
}

fixLatestStream().catch(console.error);
