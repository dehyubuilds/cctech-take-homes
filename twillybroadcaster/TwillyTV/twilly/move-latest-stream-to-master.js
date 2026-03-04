const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function moveLatestStreamToMaster() {
  const streamKey = 'sk_pcrgqy502uyqx7eh';
  const wrongAccount = 'djmets10@yahoo.com';
  const masterAccount = 'dehyu.sinyan@gmail.com';
  
  console.log(`🔍 Moving files from wrong account to master account...\n`);
  console.log(`   StreamKey: ${streamKey}`);
  console.log(`   From: USER#${wrongAccount}`);
  console.log(`   To: USER#${masterAccount}\n`);
  
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
  
  console.log(`Found ${wrongFiles.Items.length} file(s) to move:\n`);
  
  for (const file of wrongFiles.Items) {
    console.log(`Moving: ${file.fileName || file.SK}`);
    console.log(`   From: ${file.PK}`);
    
    try {
      // Create new file entry under master account
      const newFile = {
        ...file,
        PK: `USER#${masterAccount}`
      };
      
      // Delete old entry
      await dynamodb.delete({
        TableName: table,
        Key: {
          PK: file.PK,
          SK: file.SK
        }
      }).promise();
      
      // Create new entry under master account
      await dynamodb.put({
        TableName: table,
        Item: newFile
      }).promise();
      
      console.log(`   ✅ Moved to: USER#${masterAccount}\n`);
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}\n`);
    }
  }
  
  console.log(`✅ Finished moving ${wrongFiles.Items.length} file(s) to master account`);
}

moveLatestStreamToMaster().catch(console.error);
