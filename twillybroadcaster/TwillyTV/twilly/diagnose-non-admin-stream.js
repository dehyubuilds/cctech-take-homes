const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function diagnose() {
  console.log('🔍 Diagnosing non-admin stream flow...\n');
  
  // Step 1: Find all collaborator stream keys for Twilly TV
  console.log('Step 1: Finding collaborator stream keys for Twilly TV...\n');
  const allStreamKeys = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND (channelName = :channelName OR seriesName = :channelName) AND isCollaboratorKey = :isCollab',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':channelName': 'Twilly TV',
      ':isCollab': true
    }
  }).promise();
  
  if (allStreamKeys.Items && allStreamKeys.Items.length > 0) {
    console.log(`✅ Found ${allStreamKeys.Items.length} collaborator stream key(s) for Twilly TV:\n`);
    allStreamKeys.Items.forEach((mapping, idx) => {
      console.log(`[${idx + 1}] StreamKey: ${mapping.streamKey || mapping.PK.replace('STREAM_KEY#', '')}`);
      console.log(`   collaboratorEmail: ${mapping.collaboratorEmail || 'N/A'}`);
      console.log(`   ownerEmail: ${mapping.ownerEmail || 'N/A'}`);
      console.log(`   channelName: ${mapping.channelName || 'N/A'}`);
      console.log(`   seriesName: ${mapping.seriesName || 'N/A'}`);
      console.log(`   isCollaboratorKey: ${mapping.isCollaboratorKey} (type: ${typeof mapping.isCollaboratorKey})`);
      console.log(`   creatorId: ${mapping.creatorId || 'N/A'}`);
      console.log('');
    });
    
    // Step 2: Check files created with these stream keys
    console.log('\nStep 2: Checking files created with these stream keys...\n');
    const allFiles = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#'
      }
    }).promise();
    
    for (const mapping of allStreamKeys.Items) {
      const streamKey = mapping.streamKey || mapping.PK.replace('STREAM_KEY#', '');
      const files = allFiles.Items.filter(f => f.streamKey === streamKey);
      
      if (files.length > 0) {
        console.log(`\n📹 Files for streamKey ${streamKey}:`);
        files.forEach((file, idx) => {
          console.log(`   [${idx + 1}] ${file.fileName}`);
          console.log(`       Stored under: ${file.PK}`);
          console.log(`       folderName: ${file.folderName || 'N/A'}`);
          console.log(`       isVisible: ${file.isVisible}`);
          console.log(`       isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
          console.log(`       creatorId: ${file.creatorId || 'N/A'}`);
          console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
          
          // Check if it should be visible
          const shouldBeUnder = 'USER#dehyu.sinyan@gmail.com';
          const shouldBeVisible = file.isVisible === true;
          const shouldHaveFolderName = file.folderName === 'Twilly TV';
          
          if (file.PK !== shouldBeUnder) {
            console.log(`       ⚠️ WRONG LOCATION - should be under ${shouldBeUnder}`);
          }
          if (!shouldBeVisible) {
            console.log(`       ⚠️ NOT VISIBLE - isVisible is ${file.isVisible}`);
          }
          if (!shouldHaveFolderName) {
            console.log(`       ⚠️ WRONG FOLDER - folderName is "${file.folderName}" but should be "Twilly TV"`);
          }
          if (file.PK === shouldBeUnder && shouldBeVisible && shouldHaveFolderName) {
            console.log(`       ✅ CORRECT - should appear in Twilly TV channel`);
          }
        });
      } else {
        console.log(`\n⚠️ No files found for streamKey ${streamKey}`);
      }
    }
    
    // Step 3: Simulate get-content API query
    console.log('\n\nStep 3: Simulating get-content API query for Twilly TV...\n');
    const masterEmail = 'dehyu.sinyan@gmail.com';
    const channelName = 'Twilly TV';
    
    const contentQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${masterEmail}`,
        ':skPrefix': 'FILE#'
      }
    }).promise();
    
    console.log(`Querying from: USER#${masterEmail}`);
    console.log(`Found ${contentQuery.Items.length} total files\n`);
    
    // Filter like get-content API does
    const filtered = contentQuery.Items.filter(file => {
      const fileChannelName = file.folderName || file.seriesName;
      const matchesChannel = fileChannelName === channelName;
      const isVisible = file.isVisible === true;
      const hasContent = file.fileName && !file.isFolder;
      const hasHls = file.hlsUrl;
      const hasStreamKey = file.streamKey;
      const hasThumbnail = file.thumbnailUrl && 
                           file.thumbnailUrl.trim() !== '' &&
                           file.thumbnailUrl !== 'null' &&
                           file.thumbnailUrl.startsWith('http');
      
      if (file.category === 'Videos') {
        if (!hasHls) return false;
        if (!hasStreamKey) return false;
        if (!hasThumbnail) return false;
      }
      
      return matchesChannel && isVisible && hasContent;
    });
    
    console.log(`After filtering: ${filtered.length} visible videos in Twilly TV channel\n`);
    filtered.forEach((file, idx) => {
      console.log(`[${idx + 1}] ${file.fileName}`);
      console.log(`    streamKey: ${file.streamKey}`);
      console.log(`    creatorId: ${file.creatorId || 'N/A'}`);
      console.log(`    isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
    });
  } else {
    console.log('⚠️ No collaborator stream keys found for Twilly TV');
  }
}

diagnose().catch(console.error);
