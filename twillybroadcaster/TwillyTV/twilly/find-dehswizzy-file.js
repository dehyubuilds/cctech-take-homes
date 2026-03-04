const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findDehswizzy() {
  console.log('🔍 Finding files with username "dehswizzy"...\n');
  
  // Find all streamKey mappings with username dehswizzy
  const mappings = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND username = :username',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':username': 'dehswizzy'
    }
  }).promise();
  
  if (mappings.Items && mappings.Items.length > 0) {
    console.log(`✅ Found ${mappings.Items.length} streamKey mapping(s) with username "dehswizzy":\n`);
    const filesToRemove = [];
    
    for (const mapping of mappings.Items) {
      const streamKey = mapping.streamKey || mapping.PK.replace('STREAM_KEY#', '');
      console.log(`StreamKey: ${streamKey}`);
      console.log(`  channelName: ${mapping.channelName || 'N/A'}`);
      console.log(`  creatorId: ${mapping.creatorId || 'N/A'}`);
      console.log('');
      
      // Find files with this streamKey
      const allFiles = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pkPrefix': 'USER#',
          ':skPrefix': 'FILE#'
        }
      }).promise();
      
      const matchingFiles = allFiles.Items.filter(f => f.streamKey === streamKey);
      
      if (matchingFiles.length > 0) {
        console.log(`  Found ${matchingFiles.length} file(s) with this streamKey:\n`);
        matchingFiles.forEach(file => {
          console.log(`    - ${file.fileName}`);
          console.log(`      Stored under: ${file.PK}`);
          console.log(`      folderName: ${file.folderName || 'N/A'}`);
          console.log(`      isVisible: ${file.isVisible}`);
          console.log(`      SK: ${file.SK}`);
          if (file.PK !== 'USER#dehyu.sinyan@gmail.com') {
            console.log(`      ⚠️ ROGUE FILE - stored under wrong account!`);
          }
          filesToRemove.push(file);
        });
        console.log('');
      }
    }
    
    if (filesToRemove.length > 0) {
      console.log(`\n🗑️ Removing ${filesToRemove.length} file(s)...\n`);
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
    }
  } else {
    console.log('⚠️ No streamKey mappings found with username "dehswizzy"');
  }
}

findDehswizzy().catch(console.error);
