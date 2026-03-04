const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findAllDehswizzy() {
  console.log('🔍 Finding ALL files that would show username "dehswizzy"...\n');
  
  // Get all Twilly TV files
  const allFiles = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':skPrefix': 'FILE#'
    }
  }).promise();
  
  const twillyTVFiles = allFiles.Items.filter(f => 
    (f.folderName === 'Twilly TV' || f.seriesName === 'Twilly TV') &&
    f.category === 'Videos' &&
    f.isVisible === true &&
    f.fileName &&
    f.hlsUrl &&
    f.streamKey
  );
  
  console.log(`Found ${twillyTVFiles.length} Twilly TV files. Checking username lookup for each...\n`);
  
  const filesWithDehswizzy = [];
  
  for (const file of twillyTVFiles) {
    let username = null;
    
    // Check streamKey mapping
    if (file.streamKey) {
      try {
        const mapping = await dynamodb.get({
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${file.streamKey}`,
            SK: 'MAPPING'
          }
        }).promise();
        
        if (mapping.Item) {
          // Check if mapping has username directly
          if (mapping.Item.username === 'dehswizzy') {
            username = 'dehswizzy';
          }
          
          // Check creatorId lookup (like get-content API does)
          if (!username && mapping.Item.creatorId) {
            try {
              const userLookup = await dynamodb.get({
                TableName: table,
                Key: {
                  PK: 'USER',
                  SK: mapping.Item.creatorId
                }
              }).promise();
              
              if (userLookup.Item && userLookup.Item.username === 'dehswizzy') {
                username = 'dehswizzy';
              }
            } catch (err) {
              // Skip if lookup fails
            }
          }
        }
      } catch (err) {
        // Skip if mapping doesn't exist
      }
    }
    
    // Check file's creatorId
    if (!username && file.creatorId) {
      try {
        const userLookup = await dynamodb.get({
          TableName: table,
          Key: {
            PK: 'USER',
            SK: file.creatorId
          }
        }).promise();
        
        if (userLookup.Item && userLookup.Item.username === 'dehswizzy') {
          username = 'dehswizzy';
        }
      } catch (err) {
        // Skip if lookup fails
      }
    }
    
    if (username === 'dehswizzy') {
      filesWithDehswizzy.push(file);
      console.log(`✅ Found file with username "dehswizzy":`);
      console.log(`   fileName: ${file.fileName}`);
      console.log(`   PK: ${file.PK}`);
      console.log(`   SK: ${file.SK}`);
      console.log(`   streamKey: ${file.streamKey}`);
      console.log(`   creatorId: ${file.creatorId || 'N/A'}`);
      if (file.PK !== 'USER#dehyu.sinyan@gmail.com') {
        console.log(`   ⚠️ ROGUE FILE - stored under wrong account!`);
      }
      console.log('');
    }
  }
  
  if (filesWithDehswizzy.length > 0) {
    console.log(`\n🗑️ Removing ${filesWithDehswizzy.length} file(s)...\n`);
    for (const file of filesWithDehswizzy) {
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
    console.log('⚠️ No files found that would show username "dehswizzy"');
  }
}

findAllDehswizzy().catch(console.error);
