const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function testNonAdminStream() {
  console.log('🔍 Testing non-admin stream flow...\n');
  
  // Find a recent non-admin stream key for Twilly TV
  const allStreamKeys = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND isCollaboratorKey = :isCollab AND (channelName = :channelName OR seriesName = :channelName)',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':isCollab': true,
      ':channelName': 'Twilly TV'
    }
  }).promise();
  
  if (allStreamKeys.Items && allStreamKeys.Items.length > 0) {
    // Find one that's NOT the admin's email
    const nonAdminKey = allStreamKeys.Items.find(m => {
      const email = m.collaboratorEmail || m.ownerEmail;
      return email && email !== 'dehyu.sinyan@gmail.com';
    });
    
    if (nonAdminKey) {
      const streamKey = nonAdminKey.streamKey || nonAdminKey.PK.replace('STREAM_KEY#', '');
      console.log(`✅ Found non-admin stream key: ${streamKey}\n`);
      console.log(`   collaboratorEmail: ${nonAdminKey.collaboratorEmail || 'N/A'}`);
      console.log(`   channelName: ${nonAdminKey.channelName || 'N/A'}`);
      console.log(`   seriesName: ${nonAdminKey.seriesName || 'N/A'}`);
      console.log(`   isCollaboratorKey: ${nonAdminKey.isCollaboratorKey}`);
      console.log(`   creatorId: ${nonAdminKey.creatorId || 'N/A'}\n`);
      
      // Check if there are files for this stream key
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
        console.log(`📹 Found ${allFiles.Items.length} file(s) for this stream key:\n`);
        allFiles.Items.forEach((file, idx) => {
          console.log(`[${idx + 1}] ${file.fileName}`);
          console.log(`    Stored under: ${file.PK}`);
          console.log(`    folderName: ${file.folderName || 'N/A'}`);
          console.log(`    isVisible: ${file.isVisible}`);
          console.log(`    isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
          console.log(`    creatorId: ${file.creatorId || 'N/A'}`);
          console.log(`    createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
          
          const shouldBeUnder = 'USER#dehyu.sinyan@gmail.com';
          const shouldBeVisible = file.isVisible === true;
          const shouldHaveFolderName = file.folderName === 'Twilly TV';
          
          if (file.PK !== shouldBeUnder) {
            console.log(`    ❌ WRONG LOCATION - should be under ${shouldBeUnder}`);
          }
          if (!shouldBeVisible) {
            console.log(`    ❌ NOT VISIBLE - isVisible is ${file.isVisible}`);
          }
          if (!shouldHaveFolderName) {
            console.log(`    ❌ WRONG FOLDER - folderName is "${file.folderName}" but should be "Twilly TV"`);
          }
          if (file.PK === shouldBeUnder && shouldBeVisible && shouldHaveFolderName) {
            console.log(`    ✅ CORRECT - should appear in Twilly TV channel`);
          }
          console.log('');
        });
      } else {
        console.log(`⚠️ No files found for stream key ${streamKey}`);
        console.log(`   This means either:`);
        console.log(`   1. The stream hasn't been processed yet`);
        console.log(`   2. The stream failed to process`);
        console.log(`   3. The stream was deleted`);
      }
    } else {
      console.log('⚠️ No non-admin stream keys found');
    }
  } else {
    console.log('⚠️ No collaborator stream keys found');
  }
}

testNonAdminStream().catch(console.error);
