const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findDehswizzy() {
  console.log('🔍 Finding files that would show username "dehswizzy" via username lookup...\n');
  
  // First, find the userId for dehswizzy
  let dehswizzyUserId = null;
  const allUsers = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix)',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#'
    }
  }).promise();
  
  for (const item of allUsers.Items) {
    if (item.username === 'dehswizzy') {
      // Check if PK is in format USER#userId (UUID format)
      const pkValue = item.PK.replace('USER#', '');
      if (pkValue.includes('-')) {
        dehswizzyUserId = pkValue;
        console.log(`✅ Found dehswizzy userId: ${dehswizzyUserId}`);
        console.log(`   PK: ${item.PK}`);
        console.log(`   SK: ${item.SK}`);
        break;
      } else if (item.userId) {
        dehswizzyUserId = item.userId;
        console.log(`✅ Found dehswizzy userId: ${dehswizzyUserId}`);
        break;
      }
    }
  }
  
  if (!dehswizzyUserId) {
    console.log('❌ Could not find userId for dehswizzy');
    return;
  }
  
  // Find all files with this creatorId
  console.log(`\n🔍 Searching for files with creatorId: ${dehswizzyUserId}...\n`);
  const allFiles = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':skPrefix': 'FILE#'
    }
  }).promise();
  
  const filesWithCreatorId = allFiles.Items.filter(f => f.creatorId === dehswizzyUserId);
  
  if (filesWithCreatorId.length > 0) {
    console.log(`✅ Found ${filesWithCreatorId.length} file(s) with creatorId ${dehswizzyUserId}:\n`);
    filesWithCreatorId.forEach((file, idx) => {
      console.log(`[${idx + 1}] File:`);
      console.log(`   PK: ${file.PK}`);
      console.log(`   SK: ${file.SK}`);
      console.log(`   fileName: ${file.fileName || 'N/A'}`);
      console.log(`   folderName: ${file.folderName || 'N/A'}`);
      console.log(`   streamKey: ${file.streamKey || 'N/A'}`);
      console.log(`   isVisible: ${file.isVisible}`);
      console.log(`   createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
      if (file.PK !== 'USER#dehyu.sinyan@gmail.com') {
        console.log(`   ⚠️ ROGUE FILE - stored under wrong account!`);
        console.log(`   This file will show on mobile but NOT on web!`);
      }
      console.log('');
    });
    
    // Remove all files
    console.log(`🗑️ Removing ${filesWithCreatorId.length} file(s)...\n`);
    for (const file of filesWithCreatorId) {
      try {
        await dynamodb.delete({
          TableName: table,
          Key: {
            PK: file.PK,
            SK: file.SK
          }
        }).promise();
        console.log(`✅ Deleted: ${file.fileName || file.SK}`);
      } catch (error) {
        console.error(`❌ Error deleting ${file.fileName || file.SK}: ${error.message}`);
      }
    }
    console.log(`\n✅ All files removed!`);
  } else {
    console.log('⚠️ No files found with that creatorId');
  }
}

findDehswizzy().catch(console.error);
