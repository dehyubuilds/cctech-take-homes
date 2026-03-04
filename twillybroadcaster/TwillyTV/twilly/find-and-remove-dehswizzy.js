const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findAndRemoveDehswizzyFiles() {
  console.log('🔍 Searching for files with username dehswizzy...\n');
  
  // First, find the userId for dehswizzy by scanning USER profiles
  // Username can be stored in PK format USER#userId with SK=PROFILE
  const userScan = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND username = :username',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':username': 'dehswizzy'
    }
  }).promise();
  
  let userId = null;
  let userEmail = null;
  
  if (userScan.Items && userScan.Items.length > 0) {
    console.log('✅ Found user profile(s):');
    for (const item of userScan.Items) {
      console.log(`   PK: ${item.PK}`);
      console.log(`   SK: ${item.SK}`);
      console.log(`   userId: ${item.userId || 'N/A'}`);
      console.log(`   username: ${item.username || 'N/A'}`);
      console.log(`   email: ${item.email || 'N/A'}`);
      
      // If SK is PROFILE, userId might be in PK (format: USER#userId)
      if (item.SK === 'PROFILE' || item.SK === 'USER_PROFILE') {
        if (item.userId) {
          userId = item.userId;
        } else {
          // Extract userId from PK (format: USER#userId)
          const pkUserId = item.PK.replace('USER#', '');
          // Check if it's a UUID format (has dashes)
          if (pkUserId.includes('-')) {
            userId = pkUserId;
          }
        }
      }
      if (item.email) userEmail = item.email;
      console.log('');
    }
  }
  
  // If we still don't have userId, try to find by PK format USER#userId where username matches
  if (!userId) {
    console.log('🔍 Searching for userId in PK format...\n');
    const allUsers = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#'
      }
    }).promise();
    
    for (const item of allUsers.Items) {
      if (item.username === 'dehswizzy') {
        // Extract userId from PK
        const pkUserId = item.PK.replace('USER#', '');
        if (pkUserId.includes('-')) {
          userId = pkUserId;
          console.log(`✅ Found userId from PK: ${userId}`);
          break;
        }
      }
    }
  }
  
  // Also try to find by email if we have it
  if (userEmail) {
    console.log(`🔍 Searching for files under email: ${userEmail}...\n`);
    const emailFiles = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userEmail}`,
        ':skPrefix': 'FILE#'
      }
    }).promise();
    
    if (emailFiles.Items && emailFiles.Items.length > 0) {
      console.log(`✅ Found ${emailFiles.Items.length} file(s) under ${userEmail}:`);
      emailFiles.Items.forEach((file, idx) => {
        console.log(`\n[${idx + 1}] File:`);
        console.log(`   PK: ${file.PK}`);
        console.log(`   SK: ${file.SK}`);
        console.log(`   fileName: ${file.fileName || 'N/A'}`);
        console.log(`   folderName: ${file.folderName || 'N/A'}`);
        console.log(`   streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`   isVisible: ${file.isVisible}`);
        console.log(`   createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
      });
    }
  }
  
  // Search for files with creatorId matching dehswizzy's userId
  if (userId) {
    console.log(`\n🔍 Searching for files with creatorId: ${userId}...\n`);
    
    const allFiles = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#'
      }
    }).promise();
    
    const filesWithCreatorId = allFiles.Items.filter(f => f.creatorId === userId);
    
    if (filesWithCreatorId.length > 0) {
      console.log(`✅ Found ${filesWithCreatorId.length} file(s) with creatorId ${userId}:`);
      filesWithCreatorId.forEach((file, idx) => {
        console.log(`\n[${idx + 1}] File:`);
        console.log(`   PK: ${file.PK}`);
        console.log(`   SK: ${file.SK}`);
        console.log(`   fileName: ${file.fileName || 'N/A'}`);
        console.log(`   folderName: ${file.folderName || 'N/A'}`);
        console.log(`   streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`   isVisible: ${file.isVisible}`);
        console.log(`   createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
      });
      
      // Remove all files
      console.log(`\n🗑️ Removing ${filesWithCreatorId.length} file(s)...\n`);
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
  
  // Also search streamKey mappings
  console.log('\n🔍 Searching streamKey mappings for dehswizzy...\n');
  const streamKeyScan = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND (username = :username OR contains(username, :username))',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':username': 'dehswizzy'
    }
  }).promise();
  
  if (streamKeyScan.Items && streamKeyScan.Items.length > 0) {
    console.log(`✅ Found ${streamKeyScan.Items.length} streamKey mapping(s):`);
    streamKeyScan.Items.forEach((mapping, idx) => {
      console.log(`\n[${idx + 1}] StreamKey Mapping:`);
      console.log(`   PK: ${mapping.PK}`);
      console.log(`   SK: ${mapping.SK}`);
      console.log(`   streamKey: ${mapping.streamKey || mapping.PK.replace('STREAM_KEY#', '')}`);
      console.log(`   channelName: ${mapping.channelName || 'N/A'}`);
    });
  }
}

findAndRemoveDehswizzyFiles().catch(console.error);
