const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkNonAdminFiles() {
  const nonAdminEmail = 'dehyubuilds@gmail.com';
  const streamKey = 'twillytvdur4k9l2';
  
  console.log(`🔍 Checking files for non-admin account: ${nonAdminEmail}`);
  console.log(`   StreamKey: ${streamKey}\n`);
  
  // Check files under non-admin account
  console.log('STEP 1: Files stored under non-admin account...\n');
  const filesUnderNonAdmin = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${nonAdminEmail}`,
      ':skPrefix': 'FILE#'
    }
  }).promise();
  
  if (filesUnderNonAdmin.Items && filesUnderNonAdmin.Items.length > 0) {
    console.log(`✅ Found ${filesUnderNonAdmin.Items.length} file(s) under ${nonAdminEmail}:`);
    filesUnderNonAdmin.Items.forEach((file, idx) => {
      console.log(`\n[${idx + 1}] ${file.fileName}`);
      console.log(`   streamKey: ${file.streamKey || 'N/A'}`);
      console.log(`   folderName: ${file.folderName || 'N/A'}`);
      console.log(`   isVisible: ${file.isVisible}`);
      console.log(`   isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
      console.log(`   createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
      
      if (file.streamKey === streamKey) {
        console.log(`   ⚠️ THIS FILE USES THE STREAM KEY BUT IS STORED UNDER WRONG ACCOUNT!`);
        console.log(`   Should be under: USER#dehyu.sinyan@gmail.com`);
      }
    });
  } else {
    console.log(`⚠️ No files found under ${nonAdminEmail}`);
  }
  
  // Check files with this streamKey anywhere
  console.log('\n\nSTEP 2: Files with this streamKey (anywhere)...\n');
  const allFiles = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND streamKey = :streamKey',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':skPrefix': 'FILE#',
      ':streamKey': streamKey
    }
  }).promise();
  
  if (allFiles.Items && allFiles.Items.length > 0) {
    console.log(`✅ Found ${allFiles.Items.length} file(s) with streamKey ${streamKey}:`);
    allFiles.Items.forEach((file, idx) => {
      console.log(`\n[${idx + 1}] ${file.fileName}`);
      console.log(`   Stored under: ${file.PK}`);
      console.log(`   folderName: ${file.folderName || 'N/A'}`);
      console.log(`   isVisible: ${file.isVisible}`);
      console.log(`   isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
      console.log(`   creatorId: ${file.creatorId || 'N/A'}`);
    });
  } else {
    console.log(`⚠️ No files found with streamKey ${streamKey}`);
    console.log(`   This means the stream was never processed or files were deleted`);
  }
  
  // Check streamKey mapping
  console.log('\n\nSTEP 3: StreamKey Mapping...\n');
  const mapping = await dynamodb.get({
    TableName: table,
    Key: {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING'
    }
  }).promise();
  
  if (mapping.Item) {
    console.log(`✅ StreamKey mapping found:`);
    console.log(`   collaboratorEmail: ${mapping.Item.collaboratorEmail || 'N/A'}`);
    console.log(`   ownerEmail: ${mapping.Item.ownerEmail || 'N/A'}`);
    console.log(`   channelName: ${mapping.Item.channelName || 'N/A'}`);
    console.log(`   seriesName: ${mapping.Item.seriesName || 'N/A'}`);
    console.log(`   isCollaboratorKey: ${mapping.Item.isCollaboratorKey || false}`);
    console.log(`   isPersonalKey: ${mapping.Item.isPersonalKey || false}`);
    console.log(`   creatorId: ${mapping.Item.creatorId || 'N/A'}`);
    
    // Simulate what Lambda would see
    console.log('\n\nSTEP 4: Simulating Lambda Processing...\n');
    const folderName = mapping.Item.channelName || mapping.Item.seriesName;
    const isCollaboratorKey = mapping.Item.isCollaboratorKey === true || 
                              mapping.Item.isCollaboratorKey === 'true' ||
                              mapping.Item.isCollaboratorKey === 1;
    
    console.log(`Lambda would see:`);
    console.log(`   folderName: ${folderName || 'N/A'}`);
    console.log(`   isCollaboratorKey: ${isCollaboratorKey}`);
    console.log(`   collaboratorEmail: ${mapping.Item.collaboratorEmail || 'N/A'}`);
    console.log(`   ownerEmail: ${mapping.Item.ownerEmail || 'N/A'}`);
    
    if (isCollaboratorKey) {
      console.log(`\n✅ Lambda logic: isCollaboratorKey = true`);
      console.log(`   → Should use masterEmail = 'dehyu.sinyan@gmail.com'`);
      console.log(`   → Should store under: USER#dehyu.sinyan@gmail.com`);
      console.log(`   → folderName should be: ${folderName || 'Twilly TV'}`);
    } else {
      console.log(`\n⚠️ Lambda logic: isCollaboratorKey = false`);
      console.log(`   → Would use different logic`);
    }
  } else {
    console.log(`❌ No streamKey mapping found!`);
  }
}

checkNonAdminFiles().catch(console.error);
