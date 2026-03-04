const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function traceRTMPFlow() {
  console.log('🔍 TRACING RTMP KEY FLOW END-TO-END\n');
  console.log('='.repeat(80));
  
  // Admin account
  const adminEmail = 'dehyu.sinyan@gmail.com';
  const nonAdminEmail = 'dehyubuilds@gmail.com';
  
  console.log('\n📊 PART 1: ADMIN ACCOUNT FLOW (dehyu.sinyan@gmail.com)\n');
  console.log('-'.repeat(80));
  
  // Step 1: Find admin's stream keys for Twilly TV
  console.log('\nSTEP 1: Finding admin stream keys for Twilly TV...');
  const adminStreamKeys = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND (channelName = :channelName OR seriesName = :channelName) AND (ownerEmail = :email OR collaboratorEmail = :email)',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':channelName': 'Twilly TV',
      ':email': adminEmail
    }
  }).promise();
  
  if (adminStreamKeys.Items && adminStreamKeys.Items.length > 0) {
    console.log(`✅ Found ${adminStreamKeys.Items.length} admin stream key(s):`);
    adminStreamKeys.Items.forEach((key, idx) => {
      console.log(`\n[${idx + 1}] StreamKey: ${key.streamKey || key.PK.replace('STREAM_KEY#', '')}`);
      console.log(`   ownerEmail: ${key.ownerEmail || 'N/A'}`);
      console.log(`   collaboratorEmail: ${key.collaboratorEmail || 'N/A'}`);
      console.log(`   channelName: ${key.channelName || 'N/A'}`);
      console.log(`   seriesName: ${key.seriesName || 'N/A'}`);
      console.log(`   isCollaboratorKey: ${key.isCollaboratorKey || false}`);
      console.log(`   isPersonalKey: ${key.isPersonalKey || false}`);
      console.log(`   creatorId: ${key.creatorId || 'N/A'}`);
      
      // Check files created with this key
      const streamKey = key.streamKey || key.PK.replace('STREAM_KEY#', '');
      checkFilesForStreamKey(streamKey, 'ADMIN');
    });
  } else {
    console.log('⚠️ No admin stream keys found for Twilly TV');
  }
  
  console.log('\n\n📊 PART 2: NON-ADMIN ACCOUNT FLOW (dehyubuilds@gmail.com)\n');
  console.log('-'.repeat(80));
  
  // Step 1: Find non-admin's stream keys for Twilly TV
  console.log('\nSTEP 1: Finding non-admin stream keys for Twilly TV...');
  const nonAdminStreamKeys = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND (channelName = :channelName OR seriesName = :channelName) AND (ownerEmail = :email OR collaboratorEmail = :email)',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':channelName': 'Twilly TV',
      ':email': nonAdminEmail
    }
  }).promise();
  
  if (nonAdminStreamKeys.Items && nonAdminStreamKeys.Items.length > 0) {
    console.log(`✅ Found ${nonAdminStreamKeys.Items.length} non-admin stream key(s):`);
    nonAdminStreamKeys.Items.forEach((key, idx) => {
      console.log(`\n[${idx + 1}] StreamKey: ${key.streamKey || key.PK.replace('STREAM_KEY#', '')}`);
      console.log(`   ownerEmail: ${key.ownerEmail || 'N/A'}`);
      console.log(`   collaboratorEmail: ${key.collaboratorEmail || 'N/A'}`);
      console.log(`   channelName: ${key.channelName || 'N/A'}`);
      console.log(`   seriesName: ${key.seriesName || 'N/A'}`);
      console.log(`   isCollaboratorKey: ${key.isCollaboratorKey || false}`);
      console.log(`   isPersonalKey: ${key.isPersonalKey || false}`);
      console.log(`   creatorId: ${key.creatorId || 'N/A'}`);
      
      // Check files created with this key
      const streamKey = key.streamKey || key.PK.replace('STREAM_KEY#', '');
      checkFilesForStreamKey(streamKey, 'NON-ADMIN');
    });
  } else {
    console.log('⚠️ No non-admin stream keys found for Twilly TV');
  }
  
  // Step 2: Check what get-content API would see
  console.log('\n\n📊 PART 3: WHAT GET-CONTENT API SEES\n');
  console.log('-'.repeat(80));
  
  const masterEmail = 'dehyu.sinyan@gmail.com';
  const channelName = 'Twilly TV';
  
  console.log(`\nQuerying from: USER#${masterEmail}`);
  console.log(`Channel: ${channelName}\n`);
  
  const contentQuery = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${masterEmail}`,
      ':skPrefix': 'FILE#'
    }
  }).promise();
  
  console.log(`Found ${contentQuery.Items.length} total files under master account\n`);
  
  // Filter like get-content API does
  const visibleVideos = contentQuery.Items.filter(file => {
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
  
  console.log(`After filtering (like get-content API): ${visibleVideos.length} visible videos\n`);
  visibleVideos.forEach((file, idx) => {
    console.log(`[${idx + 1}] ${file.fileName}`);
    console.log(`    streamKey: ${file.streamKey}`);
    console.log(`    creatorId: ${file.creatorId || 'N/A'}`);
    console.log(`    isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
    console.log(`    createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
    
    // Check streamKey mapping for this file
    if (file.streamKey) {
      checkStreamKeyMapping(file.streamKey);
    }
  });
}

async function checkFilesForStreamKey(streamKey, accountType) {
  console.log(`\n   📹 Files created with this streamKey:`);
  
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
    allFiles.Items.forEach((file, idx) => {
      console.log(`   [${idx + 1}] ${file.fileName}`);
      console.log(`       Stored under: ${file.PK}`);
      console.log(`       folderName: ${file.folderName || 'N/A'}`);
      console.log(`       isVisible: ${file.isVisible}`);
      console.log(`       isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
      console.log(`       creatorId: ${file.creatorId || 'N/A'}`);
      
      const shouldBeUnder = 'USER#dehyu.sinyan@gmail.com';
      const shouldBeVisible = file.isVisible === true;
      const shouldHaveFolderName = file.folderName === 'Twilly TV';
      
      if (file.PK !== shouldBeUnder) {
        console.log(`       ❌ WRONG LOCATION - should be under ${shouldBeUnder}`);
      }
      if (!shouldBeVisible) {
        console.log(`       ❌ NOT VISIBLE - isVisible is ${file.isVisible}`);
      }
      if (!shouldHaveFolderName) {
        console.log(`       ❌ WRONG FOLDER - folderName is "${file.folderName}" but should be "Twilly TV"`);
      }
      if (file.PK === shouldBeUnder && shouldBeVisible && shouldHaveFolderName) {
        console.log(`       ✅ CORRECT - should appear in Twilly TV channel`);
      }
    });
  } else {
    console.log(`   ⚠️ No files found for this streamKey`);
  }
}

async function checkStreamKeyMapping(streamKey) {
  try {
    const mapping = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    }).promise();
    
    if (mapping.Item) {
      console.log(`\n   🔑 StreamKey Mapping:`);
      console.log(`       collaboratorEmail: ${mapping.Item.collaboratorEmail || 'N/A'}`);
      console.log(`       ownerEmail: ${mapping.Item.ownerEmail || 'N/A'}`);
      console.log(`       channelName: ${mapping.Item.channelName || 'N/A'}`);
      console.log(`       isCollaboratorKey: ${mapping.Item.isCollaboratorKey || false}`);
      console.log(`       creatorId: ${mapping.Item.creatorId || 'N/A'}`);
    } else {
      console.log(`\n   ⚠️ No streamKey mapping found!`);
    }
  } catch (error) {
    console.log(`\n   ❌ Error checking streamKey mapping: ${error.message}`);
  }
}

traceRTMPFlow().catch(console.error);
