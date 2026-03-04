const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function traceFlow() {
  console.log('🔍 TRACING ENTIRE FLOW FOR LAST STREAM\n');
  console.log('='.repeat(80));
  
  // Step 1: Find the most recent stream
  console.log('\n📹 STEP 1: Finding most recent stream...');
  const allFiles = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':skPrefix': 'FILE#'
    }
  }).promise();

  const sorted = allFiles.Items
    .filter(f => (f.createdAt || f.timestamp) && f.category === 'Videos')
    .sort((a, b) => {
      const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
      const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
      return bTime - aTime;
    });

  const latest = sorted[0];
  if (!latest) {
    console.log('❌ No recent stream found');
    return;
  }

  const storedUnder = latest.PK.replace('USER#', '');
  const streamKey = latest.streamKey;
  const channelName = latest.folderName || latest.seriesName;
  
  console.log(`✅ Found: ${latest.fileName}`);
  console.log(`   Stored under: ${storedUnder}`);
  console.log(`   Channel: ${channelName}`);
  console.log(`   streamKey: ${streamKey}`);
  console.log(`   isVisible: ${latest.isVisible}`);
  console.log(`   hasHls: ${!!latest.hlsUrl}`);
  console.log(`   hasThumbnail: ${!!latest.thumbnailUrl}`);
  
  // Step 2: Check streamKey mapping
  console.log('\n📋 STEP 2: Checking streamKey mapping...');
  const mapping = await dynamodb.get({
    TableName: table,
    Key: {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING'
    }
  }).promise();
  
  if (mapping.Item) {
    console.log(`✅ StreamKey mapping found:`);
    console.log(`   channelName: ${mapping.Item.channelName}`);
    console.log(`   isCollaboratorKey: ${mapping.Item.isCollaboratorKey}`);
    console.log(`   collaboratorEmail: ${mapping.Item.collaboratorEmail || 'N/A'}`);
    console.log(`   ownerEmail: ${mapping.Item.ownerEmail || 'N/A'}`);
  } else {
    console.log('❌ No streamKey mapping found');
  }
  
  // Step 3: Find channel owner (what get-content API would use)
  console.log('\n🔍 STEP 3: Finding channel owner (master account)...');
  let channelOwner = null;
  
  // Try to find channel by name
  const channelQuery = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk',
    FilterExpression: 'channelName = :channelName AND #role = :role',
    ExpressionAttributeNames: {
      '#role': 'role'
    },
    ExpressionAttributeValues: {
      ':pk': `CHANNEL#${channelName}`,
      ':channelName': channelName,
      ':role': 'owner'
    }
  }).promise();
  
  if (channelQuery.Items && channelQuery.Items.length > 0) {
    channelOwner = channelQuery.Items[0].userEmail || channelQuery.Items[0].creatorEmail;
    console.log(`✅ Channel owner found: ${channelOwner}`);
  } else {
    // Special case for Twilly TV
    if (channelName === 'Twilly TV') {
      channelOwner = 'dehyu.sinyan@gmail.com';
      console.log(`✅ Using known owner for Twilly TV: ${channelOwner}`);
    } else {
      console.log(`⚠️ Channel owner not found for ${channelName}`);
    }
  }
  
  // Step 4: Simulate get-content API query
  console.log('\n🔍 STEP 4: Simulating get-content API query...');
  if (!channelOwner) {
    console.log('❌ Cannot simulate - no channel owner found');
    return;
  }
  
  console.log(`   Querying files from: USER#${channelOwner}`);
  const contentQuery = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${channelOwner}`,
      ':skPrefix': 'FILE#'
    }
  }).promise();
  
  console.log(`   Found ${contentQuery.Items.length} total files`);
  
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
  
  console.log(`   After filtering: ${filtered.length} visible videos`);
  
  // Check if our video is in the results
  const ourVideo = filtered.find(f => f.fileName === latest.fileName);
  if (ourVideo) {
    console.log(`✅ Video IS visible in get-content API results!`);
  } else {
    console.log(`❌ Video is NOT visible in get-content API results`);
    console.log(`   Reasons:`);
    console.log(`   - Stored under: ${storedUnder}`);
    console.log(`   - Querying from: ${channelOwner}`);
    if (storedUnder !== channelOwner) {
      console.log(`   ❌ MISMATCH: Video stored under different account!`);
    }
    
    // Check individual filters
    const fileChannelName = latest.folderName || latest.seriesName;
    const matchesChannel = fileChannelName === channelName;
    const isVisible = latest.isVisible === true;
    const hasHls = !!latest.hlsUrl;
    const hasStreamKey = !!latest.streamKey;
    const hasThumbnail = latest.thumbnailUrl && 
                         latest.thumbnailUrl.trim() !== '' &&
                         latest.thumbnailUrl !== 'null' &&
                         latest.thumbnailUrl.startsWith('http');
    
    console.log(`   Filter checks:`);
    console.log(`   - Channel match: ${matchesChannel} (${fileChannelName} === ${channelName})`);
    console.log(`   - isVisible: ${isVisible}`);
    console.log(`   - hasHls: ${hasHls}`);
    console.log(`   - hasStreamKey: ${hasStreamKey}`);
    console.log(`   - hasThumbnail: ${hasThumbnail}`);
  }
  
  // Step 5: Summary
  console.log('\n📊 STEP 5: SUMMARY');
  console.log('='.repeat(80));
  console.log(`Video: ${latest.fileName}`);
  console.log(`Stored under: ${storedUnder}`);
  console.log(`Channel owner (master): ${channelOwner}`);
  console.log(`Status: ${storedUnder === channelOwner ? '✅ CORRECT' : '❌ WRONG ACCOUNT'}`);
  console.log(`Visible in get-content: ${ourVideo ? '✅ YES' : '❌ NO'}`);
  
  if (storedUnder !== channelOwner) {
    console.log('\n⚠️ ISSUE FOUND: Video is stored under wrong account!');
    console.log(`   Expected: ${channelOwner}`);
    console.log(`   Actual: ${storedUnder}`);
    console.log(`   This means the Lambda did not correctly determine the master account.`);
  }
}

traceFlow().catch(console.error);
