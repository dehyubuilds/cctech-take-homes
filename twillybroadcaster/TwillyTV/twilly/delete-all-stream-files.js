const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function deleteAllStreamFiles() {
  const streamKey = 'sk_pcrgqy502uyqx7eh';
  
  console.log(`🗑️ Deleting ALL files for streamKey: ${streamKey}\n`);
  console.log(`   These files were created with incorrect logic and will be recreated correctly on next stream\n`);
  
  // Find ALL files with this streamKey (regardless of account)
  const allFiles = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND streamKey = :streamKey',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':skPrefix': 'FILE#',
      ':streamKey': streamKey
    }
  }).promise();
  
  if (!allFiles.Items || allFiles.Items.length === 0) {
    console.log('✅ No files found for this streamKey');
    return;
  }
  
  console.log(`Found ${allFiles.Items.length} file(s) to delete:\n`);
  
  for (const file of allFiles.Items) {
    console.log(`Deleting: ${file.fileName || file.SK}`);
    console.log(`   Stored under: ${file.PK}`);
    console.log(`   folderName: ${file.folderName || 'N/A'}`);
    console.log(`   createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
    
    try {
      await dynamodb.delete({
        TableName: table,
        Key: {
          PK: file.PK,
          SK: file.SK
        }
      }).promise();
      
      console.log(`   ✅ Deleted\n`);
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
    }
  }
  
  console.log(`✅ Finished deleting ${allFiles.Items.length} file(s)`);
  console.log(`\n💡 Future streams will be stored correctly under the master account from the start.`);
}

deleteAllStreamFiles().catch(console.error);
