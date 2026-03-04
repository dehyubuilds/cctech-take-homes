const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function compareFiltering() {
  const masterEmail = 'dehyu.sinyan@gmail.com';
  const channelName = 'Twilly TV';
  
  console.log(`🔍 Comparing filtering for ${channelName} channel...\n`);
  
  // Get all files for Twilly TV
  const result = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${masterEmail}`,
      ':skPrefix': 'FILE#'
    }
  }).promise();
  
  const allTwillyTVFiles = (result.Items || []).filter(file => {
    const fileChannelName = file.folderName || file.seriesName;
    return fileChannelName === channelName && file.category === 'Videos';
  });
  
  console.log(`📊 Total Twilly TV videos in DynamoDB: ${allTwillyTVFiles.length}\n`);
  
  // Simulate WEB APP (managefiles.vue) filtering
  console.log(`🌐 WEB APP (managefiles.vue) FILTERING:\n`);
  const webAppFiltered = allTwillyTVFiles.filter(file => {
    const hasHlsUrl = !!file.hlsUrl;
    const hasStreamKey = !!file.streamKey;
    const isVisible = file.isVisible === true;
    
    // Check for valid thumbnail
    const thumbnailUrl = file.thumbnailUrl;
    const hasValidThumbnail = thumbnailUrl && 
                              typeof thumbnailUrl === 'string' && 
                              thumbnailUrl.trim() !== '' && 
                              thumbnailUrl !== 'null' && 
                              thumbnailUrl !== 'undefined' &&
                              (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://'));
    
    // Check for invalid usernames
    const invalidUsernames = ['googoogaga', 'yess'];
    const hasInvalidUsername = file.creatorUsername && invalidUsernames.includes(file.creatorUsername.toLowerCase());
    
    const passes = hasHlsUrl && hasStreamKey && isVisible && hasValidThumbnail && !hasInvalidUsername;
    
    if (!passes) {
      console.log(`   ❌ ${file.fileName || file.SK}`);
      console.log(`      - hasHlsUrl: ${hasHlsUrl}`);
      console.log(`      - hasStreamKey: ${hasStreamKey}`);
      console.log(`      - isVisible: ${isVisible} (value: ${file.isVisible})`);
      console.log(`      - hasValidThumbnail: ${hasValidThumbnail}`);
      console.log(`      - hasInvalidUsername: ${hasInvalidUsername} (username: ${file.creatorUsername || 'N/A'})`);
    }
    
    return passes;
  });
  
  console.log(`\n✅ WEB APP would show: ${webAppFiltered.length} items\n`);
  webAppFiltered.forEach((file, idx) => {
    console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
    console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
    console.log(`       isVisible: ${file.isVisible}`);
    console.log(`       thumbnailUrl: ${file.thumbnailUrl ? 'PRESENT' : 'MISSING'}`);
    console.log(`       creatorUsername: ${file.creatorUsername || 'N/A'}`);
  });
  
  // Simulate MOBILE APP (get-content API) filtering
  console.log(`\n📱 MOBILE APP (get-content API) FILTERING:\n`);
  
  // First, simulate the initial filter (before username lookup)
  const initialFiltered = allTwillyTVFiles.filter(file => {
    const fileChannelName = file.folderName || file.seriesName;
    const matchesChannel = fileChannelName === channelName;
    const isVisible = file.isVisible === true;
    const hasHlsUrl = !!file.hlsUrl;
    const hasStreamKey = !!file.streamKey;
    const hasContent = hasHlsUrl && hasStreamKey;
    
    // Check for valid thumbnail (early filter)
    const thumbnailUrl = file.thumbnailUrl;
    let hasValidThumbnail = false;
    if (thumbnailUrl) {
      if (typeof thumbnailUrl === 'string') {
        const trimmed = thumbnailUrl.trim();
        if (trimmed !== '' && 
            trimmed !== 'null' && 
            trimmed !== 'undefined' &&
            trimmed !== 'None' &&
            trimmed !== 'none' &&
            !trimmed.startsWith('data:') &&
            (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
          try {
            const url = new URL(trimmed);
            if (url.hostname && url.pathname) {
              hasValidThumbnail = true;
            }
          } catch (e) {
            hasValidThumbnail = false;
          }
        }
      }
    }
    
    // Check for sample/test videos
    const fileName = file.fileName || '';
    const title = file.title || '';
    const fileNameLower = fileName.toLowerCase();
    const titleLower = title.toLowerCase();
    const isSampleVideo = fileNameLower.includes('sample') ||
                         fileNameLower.includes('test') ||
                         fileNameLower.includes('demo') ||
                         fileNameLower.includes('example') ||
                         titleLower.includes('sample') ||
                         titleLower.includes('test') ||
                         titleLower.includes('demo') ||
                         titleLower.includes('example');
    
    const passes = matchesChannel && isVisible && hasContent && hasValidThumbnail && !isSampleVideo;
    
    if (!passes) {
      console.log(`   ❌ ${file.fileName || file.SK} (initial filter)`);
      console.log(`      - matchesChannel: ${matchesChannel}`);
      console.log(`      - isVisible: ${isVisible} (value: ${file.isVisible})`);
      console.log(`      - hasContent: ${hasContent}`);
      console.log(`      - hasValidThumbnail: ${hasValidThumbnail}`);
      console.log(`      - isSampleVideo: ${isSampleVideo}`);
    }
    
    return passes;
  });
  
  console.log(`\n   After initial filter: ${initialFiltered.length} items`);
  
  // Then simulate the post-username-lookup filter
  const mobileFiltered = initialFiltered.filter(item => {
    // Check for invalid usernames
    const invalidUsernames = ['googoogaga', 'yess'];
    if (item.creatorUsername && invalidUsernames.includes(item.creatorUsername.toLowerCase())) {
      console.log(`   ❌ ${item.fileName || item.SK} (invalid username: ${item.creatorUsername})`);
      return false;
    }
    
    // Double-check thumbnail
    const thumbnailUrl = item.thumbnailUrl || '';
    const hasValidThumbnail = thumbnailUrl && 
                              typeof thumbnailUrl === 'string' && 
                              thumbnailUrl.trim() !== '' && 
                              thumbnailUrl !== 'null' && 
                              thumbnailUrl !== 'undefined' &&
                              (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://'));
    
    if (!hasValidThumbnail) {
      console.log(`   ❌ ${item.fileName || item.SK} (invalid thumbnail in final filter)`);
      return false;
    }
    
    // Check for test videos (additional checks)
    const fileName = item.fileName || '';
    const fileNameLower = fileName.toLowerCase();
    const isLikelyTestVideo = fileNameLower.includes('1s') || 
                              fileNameLower.includes('1sec') ||
                              fileNameLower.includes('test') ||
                              fileNameLower.includes('sample');
    
    const streamKey = item.streamKey || '';
    const streamKeyLower = streamKey.toLowerCase();
    const isOldTestStreamKey = streamKeyLower.includes('test') || 
                              streamKeyLower.includes('sample') ||
                              streamKeyLower === 'twillytvn2xif8y2';
    
    if (isLikelyTestVideo || isOldTestStreamKey) {
      console.log(`   ❌ ${item.fileName || item.SK} (test video pattern)`);
      return false;
    }
    
    // Check for blacklisted streamKeys
    const blacklistedStreamKeyPatterns = ['twillytvn2xif8y2'];
    if (blacklistedStreamKeyPatterns.some(pattern => streamKeyLower.includes(pattern.toLowerCase()))) {
      console.log(`   ❌ ${item.fileName || item.SK} (blacklisted streamKey)`);
      return false;
    }
    
    // Check streamKey format
    if (item.streamKey && !item.streamKey.startsWith('sk_') && !item.streamKey.startsWith('twillytv')) {
      console.log(`   ❌ ${item.fileName || item.SK} (invalid streamKey format: ${item.streamKey})`);
      return false;
    }
    
    return true;
  });
  
  console.log(`\n✅ MOBILE APP would show: ${mobileFiltered.length} items\n`);
  mobileFiltered.forEach((file, idx) => {
    console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
    console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
    console.log(`       isVisible: ${file.isVisible}`);
    console.log(`       thumbnailUrl: ${file.thumbnailUrl ? 'PRESENT' : 'MISSING'}`);
    console.log(`       creatorUsername: ${file.creatorUsername || 'N/A'}`);
  });
  
  // Find differences
  console.log(`\n🔍 DIFFERENCES:\n`);
  const webFileNames = new Set(webAppFiltered.map(f => f.SK));
  const mobileFileNames = new Set(mobileFiltered.map(f => f.SK));
  
  const onlyInWeb = webAppFiltered.filter(f => !mobileFileNames.has(f.SK));
  const onlyInMobile = mobileFiltered.filter(f => !webFileNames.has(f.SK));
  
  if (onlyInWeb.length > 0) {
    console.log(`   📱 Only in WEB (${onlyInWeb.length}):`);
    onlyInWeb.forEach(f => {
      console.log(`      - ${f.fileName || f.SK}`);
    });
  }
  
  if (onlyInMobile.length > 0) {
    console.log(`   📱 Only in MOBILE (${onlyInMobile.length}):`);
    onlyInMobile.forEach(f => {
      console.log(`      - ${f.fileName || f.SK}`);
      console.log(`        streamKey: ${f.streamKey || 'N/A'}`);
      console.log(`        isVisible: ${f.isVisible}`);
      console.log(`        thumbnailUrl: ${f.thumbnailUrl ? 'PRESENT' : 'MISSING'}`);
      console.log(`        creatorUsername: ${f.creatorUsername || 'N/A'}`);
    });
  }
  
  if (onlyInWeb.length === 0 && onlyInMobile.length === 0) {
    console.log(`   ✅ Both platforms show the same items!`);
  }
}

compareFiltering().catch(console.error);
