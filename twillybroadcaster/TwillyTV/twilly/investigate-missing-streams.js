const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function investigateMissingStreams() {
  console.log('🔍 Investigating missing streams...\n');
  console.log('='.repeat(80));
  
  const masterAccount = 'dehyu.sinyan@gmail.com';
  const channelName = 'Twilly TV';
  
  // Step 1: Find all recent streamKey mappings
  console.log('\n📋 STEP 1: Finding recent streamKey mappings...\n');
  const recentStreamKeys = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':sk': 'MAPPING'
    }
  }).promise();
  
  if (!recentStreamKeys.Items || recentStreamKeys.Items.length === 0) {
    console.log('❌ No streamKey mappings found');
    return;
  }
  
  // Sort by createdAt (most recent first)
  const sortedKeys = recentStreamKeys.Items.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });
  
  console.log(`Found ${sortedKeys.length} streamKey mapping(s), checking last 10:\n`);
  
  const recentKeys = sortedKeys.slice(0, 10);
  
  for (const keyMapping of recentKeys) {
    const streamKey = keyMapping.streamKey || keyMapping.PK.replace('STREAM_KEY#', '');
    console.log(`\n${'='.repeat(80)}`);
    console.log(`StreamKey: ${streamKey}`);
    console.log(`Created: ${keyMapping.createdAt || 'N/A'}`);
    console.log(`Channel: ${keyMapping.channelName || keyMapping.seriesName || 'N/A'}`);
    console.log(`Collaborator: ${keyMapping.collaboratorEmail || 'N/A'}`);
    console.log(`Owner: ${keyMapping.ownerEmail || 'N/A'}`);
    console.log(`isCollaboratorKey: ${keyMapping.isCollaboratorKey || false}`);
    console.log(`creatorId: ${keyMapping.creatorId || 'N/A'}`);
    
    // Step 2: Check if files exist for this streamKey
    console.log(`\n📋 Checking files for streamKey: ${streamKey}...`);
    
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
      console.log(`   ❌ NO FILES FOUND for streamKey: ${streamKey}`);
      console.log(`   → This stream was never processed or files weren't created`);
      continue;
    }
    
    console.log(`   ✅ Found ${allFiles.Items.length} file(s):`);
    
    // Group by account
    const filesByAccount = {};
    allFiles.Items.forEach(file => {
      const account = file.PK.replace('USER#', '');
      if (!filesByAccount[account]) {
        filesByAccount[account] = [];
      }
      filesByAccount[account].push(file);
    });
    
    for (const account in filesByAccount) {
      console.log(`\n   Account: ${account} (${filesByAccount[account].length} file(s))`);
      filesByAccount[account].forEach((file, idx) => {
        console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
        console.log(`       folderName: ${file.folderName || 'N/A'}`);
        console.log(`       isVisible: ${file.isVisible}`);
        console.log(`       isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
        console.log(`       creatorId: ${file.creatorId || 'N/A'}`);
        console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
        console.log(`       hlsUrl: ${file.hlsUrl ? '✅' : '❌'}`);
        console.log(`       thumbnailUrl: ${file.thumbnailUrl ? '✅' : '❌'}`);
        
        // Check if this file would be visible
        const isUnderMaster = account === masterAccount;
        const matchesChannel = (file.folderName || file.seriesName) === channelName;
        const isVisible = file.isVisible === true;
        const hasHls = file.hlsUrl;
        const hasStreamKey = file.streamKey;
        const hasThumbnail = file.thumbnailUrl && 
                           file.thumbnailUrl.trim() !== '' &&
                           file.thumbnailUrl !== 'null' &&
                           file.thumbnailUrl.startsWith('http');
        
        let visible = true;
        if (!isUnderMaster) {
          console.log(`       ⚠️ NOT UNDER MASTER ACCOUNT - won't show`);
          visible = false;
        }
        if (!matchesChannel) {
          console.log(`       ⚠️ Channel mismatch: ${file.folderName || file.seriesName} !== ${channelName}`);
          visible = false;
        }
        if (!isVisible) {
          console.log(`       ⚠️ isVisible is false`);
          visible = false;
        }
        if (!hasHls) {
          console.log(`       ⚠️ Missing hlsUrl`);
          visible = false;
        }
        if (!hasStreamKey) {
          console.log(`       ⚠️ Missing streamKey`);
          visible = false;
        }
        if (!hasThumbnail) {
          console.log(`       ⚠️ Missing or invalid thumbnailUrl`);
          visible = false;
        }
        
        if (visible) {
          console.log(`       ✅ WOULD BE VISIBLE`);
        } else {
          console.log(`       ❌ WOULD NOT BE VISIBLE`);
        }
      });
    }
    
    // Step 3: Check what get-content API would see
    console.log(`\n📋 What get-content API would see for this streamKey:`);
    const contentQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${masterAccount}`,
        ':skPrefix': 'FILE#'
      }
    }).promise();
    
    const visibleVideos = (contentQuery.Items || []).filter(file => {
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
    
    const streamKeyVideos = visibleVideos.filter(f => f.streamKey === streamKey);
    
    console.log(`   Querying: USER#${masterAccount}`);
    console.log(`   Channel: ${channelName}`);
    console.log(`   Total visible videos in channel: ${visibleVideos.length}`);
    console.log(`   Videos with this streamKey: ${streamKeyVideos.length}`);
    
    if (streamKeyVideos.length > 0) {
      console.log(`   ✅ STREAM IS VISIBLE`);
    } else {
      console.log(`   ❌ STREAM IS NOT VISIBLE`);
      console.log(`   Reasons:`);
      const wrongAccountFiles = allFiles.Items.filter(f => f.PK !== `USER#${masterAccount}`);
      if (wrongAccountFiles.length > 0) {
        console.log(`     1. ${wrongAccountFiles.length} file(s) stored under wrong account`);
      }
      const invisibleFiles = allFiles.Items.filter(f => f.isVisible !== true);
      if (invisibleFiles.length > 0) {
        console.log(`     2. ${invisibleFiles.length} file(s) have isVisible=false`);
      }
      const missingHls = allFiles.Items.filter(f => !f.hlsUrl);
      if (missingHls.length > 0) {
        console.log(`     3. ${missingHls.length} file(s) missing hlsUrl`);
      }
      const missingThumb = allFiles.Items.filter(f => !f.thumbnailUrl || !f.thumbnailUrl.startsWith('http'));
      if (missingThumb.length > 0) {
        console.log(`     4. ${missingThumb.length} file(s) missing thumbnailUrl`);
      }
    }
  }
  
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
}

investigateMissingStreams().catch(console.error);
