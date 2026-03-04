const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkWhoCreatedFiles() {
  const streamKey = 'sk_pcrgqy502uyqx7eh';
  
  console.log(`🔍 Checking who created files for streamKey: ${streamKey}\n`);
  
  // Get files
  const dbFiles = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND streamKey = :streamKey',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':skPrefix': 'FILE#',
      ':streamKey': streamKey
    }
  }).promise();
  
  if (!dbFiles.Items || dbFiles.Items.length === 0) {
    console.log('❌ No files found');
    return;
  }
  
  console.log(`Found ${dbFiles.Items.length} file(s):\n`);
  
  dbFiles.Items.forEach((file, idx) => {
    console.log(`[${idx + 1}] ${file.fileName || file.SK}`);
    console.log(`   Stored under: ${file.PK}`);
    console.log(`   createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
    console.log(`   uploadId: ${file.uploadId || 'N/A'}`);
    console.log(`   fileId: ${file.fileId || 'N/A'}`);
    
    // Check if fileId format indicates who created it
    // Streaming service creates: file-{uploadId}
    // Lambda creates: file-{timestamp}-{random}
    if (file.fileId) {
      if (file.fileId.startsWith('file-') && file.fileId.includes('_')) {
        console.log(`   ⚠️ FileId format suggests Lambda created this (has timestamp)`);
      } else if (file.fileId.startsWith('file-') && !file.fileId.includes('_')) {
        console.log(`   ✅ FileId format suggests streaming service created this (uses uploadId)`);
      }
    }
    
    const shouldBeUnder = 'USER#dehyu.sinyan@gmail.com';
    if (file.PK !== shouldBeUnder) {
      console.log(`   ❌ WRONG LOCATION - should be under ${shouldBeUnder}`);
      console.log(`   → This file was created by streaming service BEFORE the fix was deployed`);
      console.log(`   → OR Lambda created it with wrong logic`);
    } else {
      console.log(`   ✅ CORRECT LOCATION`);
    }
    console.log('');
  });
  
  // Check when streaming service was last restarted
  console.log(`\n📋 Analysis:`);
  const wrongLocationFiles = dbFiles.Items.filter(f => f.PK !== 'USER#dehyu.sinyan@gmail.com');
  if (wrongLocationFiles.length > 0) {
    console.log(`   ❌ ${wrongLocationFiles.length} file(s) stored under wrong account`);
    console.log(`   → Streaming service needs to be restarted to pick up the fix`);
    console.log(`   → OR Lambda is still using old logic`);
  } else {
    console.log(`   ✅ All files stored under correct account`);
  }
}

checkWhoCreatedFiles().catch(console.error);
