const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkSync() {
  console.log('🔍 Checking mobile vs web sync for Twilly TV channel...\n');
  
  // Get all files for Twilly TV channel
  const allFiles = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':skPrefix': 'FILE#'
    }
  }).promise();
  
  // Filter for Twilly TV files
  const twillyTVFiles = allFiles.Items.filter(f => 
    (f.folderName === 'Twilly TV' || f.seriesName === 'Twilly TV') &&
    f.category === 'Videos' &&
    f.isVisible === true &&
    f.fileName &&
    f.hlsUrl &&
    f.streamKey
  );
  
  console.log(`✅ Found ${twillyTVFiles.length} Twilly TV video files:\n`);
  
  // Group by owner (PK)
  const filesByOwner = {};
  twillyTVFiles.forEach(file => {
    const owner = file.PK.replace('USER#', '');
    if (!filesByOwner[owner]) {
      filesByOwner[owner] = [];
    }
    filesByOwner[owner].push(file);
  });
  
  console.log('📊 Files grouped by owner:\n');
  Object.keys(filesByOwner).forEach(owner => {
    console.log(`\n👤 Owner: ${owner} (${filesByOwner[owner].length} files)`);
    filesByOwner[owner].forEach((file, idx) => {
      console.log(`   [${idx + 1}] ${file.fileName}`);
      console.log(`       streamKey: ${file.streamKey}`);
      console.log(`       creatorId: ${file.creatorId || 'N/A'}`);
      console.log(`       isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
      console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
      
      // Check streamKey mapping for username
      if (file.streamKey) {
        dynamodb.get({
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${file.streamKey}`,
            SK: 'MAPPING'
          }
        }).promise().then(mapping => {
          if (mapping.Item) {
            console.log(`       username from mapping: ${mapping.Item.username || 'N/A'}`);
            console.log(`       isCollaboratorKey: ${mapping.Item.isCollaboratorKey || false}`);
          }
        }).catch(() => {});
      }
    });
  });
  
  // Check what get-content API would return (mobile)
  console.log('\n\n📱 What MOBILE (get-content API) would see:\n');
  console.log('   Mobile queries: USER#dehyu.sinyan@gmail.com (master account)');
  const mobileFiles = twillyTVFiles.filter(f => f.PK === 'USER#dehyu.sinyan@gmail.com');
  console.log(`   ✅ Mobile would see: ${mobileFiles.length} files\n`);
  mobileFiles.forEach((file, idx) => {
    console.log(`   [${idx + 1}] ${file.fileName}`);
    console.log(`       streamKey: ${file.streamKey}`);
  });
  
  // Check what web app would see
  console.log('\n\n🌐 What WEB APP would see:\n');
  console.log('   Web queries: USER#dehyu.sinyan@gmail.com (same as mobile)');
  const webFiles = twillyTVFiles.filter(f => f.PK === 'USER#dehyu.sinyan@gmail.com');
  console.log(`   ✅ Web would see: ${webFiles.length} files\n`);
  webFiles.forEach((file, idx) => {
    console.log(`   [${idx + 1}] ${file.fileName}`);
    console.log(`       streamKey: ${file.streamKey}`);
  });
  
  // Find files that are NOT under master account (these won't show on web/mobile)
  const rogueFiles = twillyTVFiles.filter(f => f.PK !== 'USER#dehyu.sinyan@gmail.com');
  if (rogueFiles.length > 0) {
    console.log('\n\n⚠️ ROGUE FILES (not under master account - won\'t show on web/mobile):\n');
    rogueFiles.forEach((file, idx) => {
      console.log(`   [${idx + 1}] ${file.fileName}`);
      console.log(`       Stored under: ${file.PK}`);
      console.log(`       streamKey: ${file.streamKey}`);
      console.log(`       Should be under: USER#dehyu.sinyan@gmail.com`);
    });
  }
  
  // Check for files with username "dehswizzy"
  console.log('\n\n🔍 Checking for files with username "dehswizzy"...\n');
  for (const file of twillyTVFiles) {
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
          console.log(`⚠️ Found file with username "dehswizzy":`);
          console.log(`   fileName: ${file.fileName}`);
          console.log(`   PK: ${file.PK}`);
          console.log(`   SK: ${file.SK}`);
          console.log(`   streamKey: ${file.streamKey}`);
          console.log(`   folderName: ${file.folderName}`);
          console.log(`   isVisible: ${file.isVisible}`);
          console.log(`   This file ${file.PK === 'USER#dehyu.sinyan@gmail.com' ? 'WILL' : 'WON\'T'} show on web/mobile`);
        }
      } catch (error) {
        // Skip if mapping doesn't exist
      }
    }
  }
}

checkSync().catch(console.error);
