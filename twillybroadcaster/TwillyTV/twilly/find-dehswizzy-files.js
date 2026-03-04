const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findDehswizzyFiles() {
  console.log('🔍 Finding files that display username "dehswizzy"...\n');
  
  // Step 1: Find all streamKey mappings with username "dehswizzy"
  console.log('Step 1: Searching streamKey mappings...\n');
  const streamKeyScan = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND username = :username',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':username': 'dehswizzy'
    }
  }).promise();
  
  const streamKeys = [];
  if (streamKeyScan.Items && streamKeyScan.Items.length > 0) {
    console.log(`✅ Found ${streamKeyScan.Items.length} streamKey mapping(s) with username "dehswizzy":\n`);
    streamKeyScan.Items.forEach((mapping, idx) => {
      const streamKey = mapping.streamKey || mapping.PK.replace('STREAM_KEY#', '');
      streamKeys.push(streamKey);
      console.log(`[${idx + 1}] StreamKey: ${streamKey}`);
      console.log(`   PK: ${mapping.PK}`);
      console.log(`   SK: ${mapping.SK}`);
      console.log(`   channelName: ${mapping.channelName || 'N/A'}`);
      console.log(`   creatorId: ${mapping.creatorId || 'N/A'}`);
      console.log('');
    });
  }
  
  // Step 2: Find all files with these streamKeys
  if (streamKeys.length > 0) {
    console.log(`\nStep 2: Searching for files with these streamKeys...\n`);
    const allFiles = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#'
      }
    }).promise();
    
    const matchingFiles = allFiles.Items.filter(f => streamKeys.includes(f.streamKey));
    
    if (matchingFiles.length > 0) {
      console.log(`✅ Found ${matchingFiles.length} file(s) with streamKeys that map to "dehswizzy":\n`);
      matchingFiles.forEach((file, idx) => {
        console.log(`[${idx + 1}] File:`);
        console.log(`   PK: ${file.PK}`);
        console.log(`   SK: ${file.SK}`);
        console.log(`   fileName: ${file.fileName || 'N/A'}`);
        console.log(`   folderName: ${file.folderName || 'N/A'}`);
        console.log(`   streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`   isVisible: ${file.isVisible}`);
        console.log(`   createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
        console.log('');
      });
      
      // Remove all files
      console.log(`🗑️ Removing ${matchingFiles.length} file(s)...\n`);
      for (const file of matchingFiles) {
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
      console.log('⚠️ No files found with those streamKeys');
    }
  } else {
    console.log('⚠️ No streamKey mappings found with username "dehswizzy"');
    console.log('\n🔍 Trying alternative: searching all files and checking their streamKey mappings...\n');
    
    // Alternative: scan all files and check their streamKey mappings
    const allFiles = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#'
      }
    }).promise();
    
    const filesToRemove = [];
    
    for (const file of allFiles.Items) {
      if (file.streamKey) {
        try {
          const mapping = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `STREAM_KEY#${file.streamKey}`,
              SK: 'MAPPING'
            }
          }).promise();
          
          if (mapping.Item && mapping.Item.username === 'dehswizzy') {
            filesToRemove.push(file);
          }
        } catch (error) {
          // Skip if mapping doesn't exist
        }
      }
    }
    
    if (filesToRemove.length > 0) {
      console.log(`✅ Found ${filesToRemove.length} file(s) with username "dehswizzy" in streamKey mapping:\n`);
      filesToRemove.forEach((file, idx) => {
        console.log(`[${idx + 1}] File:`);
        console.log(`   PK: ${file.PK}`);
        console.log(`   SK: ${file.SK}`);
        console.log(`   fileName: ${file.fileName || 'N/A'}`);
        console.log(`   folderName: ${file.folderName || 'N/A'}`);
        console.log(`   streamKey: ${file.streamKey || 'N/A'}`);
        console.log('');
      });
      
      console.log(`🗑️ Removing ${filesToRemove.length} file(s)...\n`);
      for (const file of filesToRemove) {
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
      console.log('⚠️ No files found with username "dehswizzy" in streamKey mapping');
    }
  }
}

findDehswizzyFiles().catch(console.error);
