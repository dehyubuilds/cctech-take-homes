const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findDehswizzyVideo() {
  const masterEmail = 'dehyu.sinyan@gmail.com';
  const channelName = 'Twilly TV';
  const targetUsername = 'dehswizzy';
  
  console.log(`🔍 Searching for videos from username "${targetUsername}"...\n`);
  
  // Step 1: Find the user's userId from their username
  let targetUserId = null;
  let targetEmail = null;
  
  try {
    // Try PK='USER', SK=username (source of truth)
    const userProfileQuery = await dynamodb.get({
      TableName: table,
      Key: {
        PK: 'USER',
        SK: targetUsername
      }
    }).promise();
    
    if (userProfileQuery.Item) {
      targetUserId = userProfileQuery.Item.userId;
      targetEmail = userProfileQuery.Item.email;
      console.log(`✅ Found user profile:`);
      console.log(`   userId: ${targetUserId}`);
      console.log(`   email: ${targetEmail}`);
    } else {
      // Fallback: Scan for user by username
      const scanParams = {
        TableName: table,
        FilterExpression: 'attribute_exists(username) AND username = :username',
        ExpressionAttributeValues: {
          ':username': targetUsername
        }
      };
      const scanResult = await dynamodb.scan(scanParams).promise();
      if (scanResult.Items && scanResult.Items.length > 0) {
        const userRecord = scanResult.Items[0];
        targetUserId = userRecord.userId;
        targetEmail = userRecord.email;
        console.log(`✅ Found user profile via scan:`);
        console.log(`   userId: ${targetUserId}`);
        console.log(`   email: ${targetEmail}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error finding user profile:`, error);
  }
  
  if (!targetUserId && !targetEmail) {
    console.log(`❌ Could not find userId or email for username: ${targetUsername}`);
    return;
  }
  
  // Step 2: Get all files for Twilly TV from master account
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
  
  console.log(`\n📊 Total Twilly TV videos: ${allTwillyTVFiles.length}\n`);
  
  // Step 3: Find videos with creatorId matching targetUserId
  const dehswizzyVideos = allTwillyTVFiles.filter(file => {
    return file.creatorId === targetUserId;
  });
  
  console.log(`🎯 Videos with creatorId=${targetUserId}: ${dehswizzyVideos.length}\n`);
  
  if (dehswizzyVideos.length === 0) {
    console.log(`⚠️ No videos found with creatorId=${targetUserId}`);
    console.log(`   Checking if any videos have streamKeys associated with this user...\n`);
    
    // Check streamKey mappings
    const streamKeyScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND (creatorId = :userId OR username = :username OR collaboratorEmail = :email)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'STREAM_KEY#',
        ':userId': targetUserId || 'N/A',
        ':username': targetUsername,
        ':email': targetEmail || 'N/A'
      }
    }).promise();
    
    if (streamKeyScan.Items && streamKeyScan.Items.length > 0) {
      console.log(`✅ Found ${streamKeyScan.Items.length} streamKey mapping(s):`);
      streamKeyScan.Items.forEach((mapping, idx) => {
        console.log(`\n   [${idx + 1}] StreamKey: ${mapping.PK.replace('STREAM_KEY#', '')}`);
        console.log(`       creatorId: ${mapping.creatorId || 'N/A'}`);
        console.log(`       username: ${mapping.username || 'N/A'}`);
        console.log(`       collaboratorEmail: ${mapping.collaboratorEmail || 'N/A'}`);
        
        // Find files with this streamKey
        const filesWithStreamKey = allTwillyTVFiles.filter(f => f.streamKey === mapping.PK.replace('STREAM_KEY#', ''));
        console.log(`       Associated files: ${filesWithStreamKey.length}`);
        filesWithStreamKey.forEach((file, fileIdx) => {
          console.log(`\n         File [${fileIdx + 1}]:`);
          console.log(`           SK: ${file.SK}`);
          console.log(`           fileName: ${file.fileName || 'N/A'}`);
          console.log(`           streamKey: ${file.streamKey || 'N/A'}`);
          console.log(`           creatorId: ${file.creatorId || 'N/A'}`);
          console.log(`           isVisible: ${file.isVisible} (type: ${typeof file.isVisible})`);
          console.log(`           hlsUrl: ${file.hlsUrl ? 'PRESENT' : 'MISSING'}`);
          console.log(`           thumbnailUrl: ${file.thumbnailUrl ? 'PRESENT' : 'MISSING'}`);
          if (file.thumbnailUrl) {
            console.log(`           thumbnailUrl value: ${file.thumbnailUrl}`);
            console.log(`           thumbnailUrl type: ${typeof file.thumbnailUrl}`);
          }
          
          // Check if it would pass web app filtering
          const hasHlsUrl = !!file.hlsUrl;
          const hasStreamKey = !!file.streamKey;
          const isVisible = file.isVisible === true;
          
          // Web app thumbnail check (updated version)
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
          
          const folderMatch = true; // Assuming Twilly TV folder
          
          const wouldShowOnWeb = hasHlsUrl && hasStreamKey && isVisible && hasValidThumbnail && folderMatch;
          
          console.log(`\n           📊 Filtering Analysis:`);
          console.log(`             hasHlsUrl: ${hasHlsUrl ? '✅' : '❌'}`);
          console.log(`             hasStreamKey: ${hasStreamKey ? '✅' : '❌'}`);
          console.log(`             isVisible: ${isVisible ? '✅' : '❌'} (value: ${file.isVisible})`);
          console.log(`             hasValidThumbnail: ${hasValidThumbnail ? '✅' : '❌'}`);
          console.log(`             folderMatch: ${folderMatch ? '✅' : '❌'}`);
          console.log(`             Would show on WEB: ${wouldShowOnWeb ? '✅ YES' : '❌ NO'}`);
          
          // Check mobile app filtering (same logic)
          const wouldShowOnMobile = wouldShowOnWeb; // Same logic now
          console.log(`             Would show on MOBILE: ${wouldShowOnMobile ? '✅ YES' : '❌ NO'}`);
        });
      });
    } else {
      console.log(`⚠️ No streamKey mappings found for username "${targetUsername}"`);
    }
    
    return;
  }
  
  // Step 4: Analyze each video
  dehswizzyVideos.forEach((file, idx) => {
    console.log(`\n[${idx + 1}] Video:`);
    console.log(`   SK: ${file.SK}`);
    console.log(`   fileName: ${file.fileName || 'N/A'}`);
    console.log(`   streamKey: ${file.streamKey || 'N/A'}`);
    console.log(`   creatorId: ${file.creatorId || 'N/A'}`);
    console.log(`   isVisible: ${file.isVisible} (type: ${typeof file.isVisible})`);
    console.log(`   hlsUrl: ${file.hlsUrl ? 'PRESENT' : 'MISSING'}`);
    console.log(`   thumbnailUrl: ${file.thumbnailUrl ? 'PRESENT' : 'MISSING'}`);
    if (file.thumbnailUrl) {
      console.log(`   thumbnailUrl value: ${file.thumbnailUrl}`);
      console.log(`   thumbnailUrl type: ${typeof file.thumbnailUrl}`);
    }
    
    // Check if it would pass web app filtering
    const hasHlsUrl = !!file.hlsUrl;
    const hasStreamKey = !!file.streamKey;
    const isVisible = file.isVisible === true;
    
    // Web app thumbnail check (updated version)
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
    
    const folderMatch = true; // Assuming Twilly TV folder
    
    const wouldShowOnWeb = hasHlsUrl && hasStreamKey && isVisible && hasValidThumbnail && folderMatch;
    
    console.log(`\n   📊 Filtering Analysis:`);
    console.log(`     hasHlsUrl: ${hasHlsUrl ? '✅' : '❌'}`);
    console.log(`     hasStreamKey: ${hasStreamKey ? '✅' : '❌'}`);
    console.log(`     isVisible: ${isVisible ? '✅' : '❌'} (value: ${file.isVisible})`);
    console.log(`     hasValidThumbnail: ${hasValidThumbnail ? '✅' : '❌'}`);
    console.log(`     folderMatch: ${folderMatch ? '✅' : '❌'}`);
    console.log(`     Would show on WEB: ${wouldShowOnWeb ? '✅ YES' : '❌ NO'}`);
    
    // Check mobile app filtering (same logic)
    const wouldShowOnMobile = wouldShowOnWeb; // Same logic now
    console.log(`     Would show on MOBILE: ${wouldShowOnMobile ? '✅ YES' : '❌ NO'}`);
    
    if (wouldShowOnMobile && !wouldShowOnWeb) {
      console.log(`\n   ⚠️ DISCREPANCY: Shows on mobile but not web!`);
    } else if (!wouldShowOnMobile && wouldShowOnWeb) {
      console.log(`\n   ⚠️ DISCREPANCY: Shows on web but not mobile!`);
    }
  });
}

findDehswizzyVideo().catch(console.error);
