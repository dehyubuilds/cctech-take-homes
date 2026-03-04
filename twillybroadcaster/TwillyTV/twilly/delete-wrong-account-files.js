const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function deleteWrongAccountFiles() {
  const streamKey = 'sk_pcrgqy502uyqx7eh';
  const wrongAccount = 'djmets10@yahoo.com';
  const masterAccount = 'dehyu.sinyan@gmail.com';
  
  console.log(`🗑️ Deleting files stored under wrong account...\n`);
  console.log(`   StreamKey: ${streamKey}`);
  console.log(`   Wrong account: USER#${wrongAccount}`);
  console.log(`   Should be under: USER#${masterAccount}\n`);
  
  // Find files under wrong account
  const wrongFiles = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'PK = :pk AND begins_with(SK, :skPrefix) AND streamKey = :streamKey',
    ExpressionAttributeValues: {
      ':pk': `USER#${wrongAccount}`,
      ':skPrefix': 'FILE#',
      ':streamKey': streamKey
    }
  }).promise();
  
  if (!wrongFiles.Items || wrongFiles.Items.length === 0) {
    console.log('✅ No files found under wrong account');
    return;
  }
  
  console.log(`Found ${wrongFiles.Items.length} file(s) to delete:\n`);
  
  for (const file of wrongFiles.Items) {
    console.log(`Deleting: ${file.fileName || file.SK}`);
    console.log(`   Stored under: ${file.PK}`);
    console.log(`   folderName: ${file.folderName || 'N/A'}`);
    
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
  
  console.log(`✅ Finished deleting ${wrongFiles.Items.length} file(s)`);
  console.log(`\n💡 These files were created with incorrect logic.`);
  console.log(`   Future streams will be stored correctly under the master account.`);
}

deleteWrongAccountFiles().catch(console.error);
