const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixWrongAccountFiles() {
  const nonAdminEmail = 'dehyubuilds@gmail.com';
  const masterEmail = 'dehyu.sinyan@gmail.com';
  const channelName = 'Twilly TV';
  
  console.log(`🔍 Finding files stored under wrong account...\n`);
  console.log(`   Non-admin account: ${nonAdminEmail}`);
  console.log(`   Master account: ${masterEmail}`);
  console.log(`   Channel: ${channelName}\n`);
  
  // Find all files under non-admin account that should be under master account
  const filesUnderNonAdmin = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${nonAdminEmail}`,
      ':skPrefix': 'FILE#'
    }
  }).promise();
  
  if (!filesUnderNonAdmin.Items || filesUnderNonAdmin.Items.length === 0) {
    console.log('✅ No files found under non-admin account');
    return;
  }
  
  console.log(`Found ${filesUnderNonAdmin.Items.length} file(s) under ${nonAdminEmail}\n`);
  
  // Filter for Twilly TV files
  const twillyTVFiles = filesUnderNonAdmin.Items.filter(file => {
    const fileChannelName = file.folderName || file.seriesName;
    return fileChannelName === channelName;
  });
  
  console.log(`Found ${twillyTVFiles.length} Twilly TV file(s) that need to be moved:\n`);
  
  if (twillyTVFiles.length === 0) {
    console.log('✅ No Twilly TV files to move');
    return;
  }
  
  // Move each file
  for (const file of twillyTVFiles) {
    console.log(`Moving: ${file.fileName}`);
    console.log(`   From: ${file.PK}`);
    console.log(`   To: USER#${masterEmail}`);
    console.log(`   streamKey: ${file.streamKey || 'N/A'}`);
    
    try {
      // Create new file entry under master account
      const newFile = {
        ...file,
        PK: `USER#${masterEmail}`,
        // Keep same SK so it's the same file entry
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
      
      console.log(`   ✅ Moved successfully\n`);
    } catch (error) {
      console.error(`   ❌ Error moving file: ${error.message}\n`);
    }
  }
  
  console.log(`\n✅ Finished moving ${twillyTVFiles.length} file(s) to master account`);
}

fixWrongAccountFiles().catch(console.error);
