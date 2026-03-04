const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkLastStreamAll() {
  console.log('🔍 Checking last stream (all files)...\n');

  // Find the most recent files
  console.log('Finding most recent files...');
  try {
    const allFilesScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#'
      }
    }).promise();

    if (allFilesScan.Items && allFilesScan.Items.length > 0) {
      // Sort by timestamp/createdAt (newest first)
      const sortedFiles = allFilesScan.Items
        .filter(f => f.createdAt || f.timestamp)
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
          const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
          return bTime - aTime;
        });

      console.log(`✅ Found ${sortedFiles.length} total files`);
      console.log(`\n📋 Most recent 5 files:`);
      
      for (let i = 0; i < Math.min(5, sortedFiles.length); i++) {
        const file = sortedFiles[i];
        const owner = file.PK ? file.PK.replace('USER#', '') : 'unknown';
        const time = file.createdAt || file.timestamp || 'N/A';
        const timeAgo = time !== 'N/A' ? Math.round((Date.now() - new Date(time).getTime()) / 1000 / 60) + ' minutes ago' : 'N/A';
        
        console.log(`\n   [${i + 1}] ${file.fileName || 'N/A'}`);
        console.log(`       Owner: ${owner}`);
        console.log(`       Channel: ${file.folderName || file.seriesName || 'N/A'}`);
        console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`       uploadId: ${file.uploadId || 'N/A'}`);
        console.log(`       Created: ${time} (${timeAgo})`);
        console.log(`       isVisible: ${file.isVisible}, hasHls: ${!!file.hlsUrl}`);
        
        // Check streamKey mapping for the most recent one
        if (i === 0 && file.streamKey) {
          console.log(`\n   🔍 Checking streamKey mapping for most recent file...`);
          try {
            const streamKeyParams = {
              TableName: table,
              Key: {
                PK: `STREAM_KEY#${file.streamKey}`,
                SK: 'MAPPING'
              }
            };
            const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
            
            if (streamKeyResult.Item) {
              console.log(`   ✅ StreamKey mapping found:`);
              console.log(`      collaboratorEmail: ${streamKeyResult.Item.collaboratorEmail || 'N/A'}`);
              console.log(`      ownerEmail: ${streamKeyResult.Item.ownerEmail || 'N/A'}`);
              console.log(`      creatorId: ${streamKeyResult.Item.creatorId || 'N/A'}`);
              console.log(`      channelName: ${streamKeyResult.Item.channelName || 'N/A'}`);
              console.log(`      isCollaboratorKey: ${streamKeyResult.Item.isCollaboratorKey}`);
              
              // Get username from creatorId
              let username = null;
              if (streamKeyResult.Item.creatorId) {
                try {
                  const userProfile = await dynamodb.get({
                    TableName: table,
                    Key: {
                      PK: `USER#${streamKeyResult.Item.creatorId}`,
                      SK: 'PROFILE'
                    }
                  }).promise();
                  
                  if (userProfile.Item) {
                    username = userProfile.Item.username || userProfile.Item.userName;
                    console.log(`\n      ✅ Username from creatorId: ${username || 'N/A'}`);
                    console.log(`      ✅ Email from profile: ${userProfile.Item.email || userProfile.Item.userEmail || 'N/A'}`);
                  }
                } catch (err) {
                  console.log(`      ⚠️ Could not get username from creatorId: ${err.message}`);
                }
              }
              
              // Also try to get username from collaboratorEmail
              if (!username && streamKeyResult.Item.collaboratorEmail) {
                try {
                  // Try to find userId from email
                  const emailScan = await dynamodb.scan({
                    TableName: table,
                    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND (email = :email OR userEmail = :email)',
                    ExpressionAttributeValues: {
                      ':pkPrefix': 'USER#',
                      ':sk': 'PROFILE',
                      ':email': streamKeyResult.Item.collaboratorEmail
                    },
                    Limit: 1
                  }).promise();
                  
                  if (emailScan.Items && emailScan.Items.length > 0) {
                    username = emailScan.Items[0].username || emailScan.Items[0].userName;
                    console.log(`\n      ✅ Username from collaboratorEmail: ${username || 'N/A'}`);
                  }
                } catch (err) {
                  // Ignore
                }
              }
              
              // Summary
              console.log(`\n   📊 SUMMARY FOR MOST RECENT STREAM:`);
              console.log(`      Username should be: ${username || 'N/A'}`);
              console.log(`      Channel should be: ${streamKeyResult.Item.channelName || file.folderName || 'N/A'}`);
              console.log(`      File is currently under: ${owner}`);
              const expectedOwner = streamKeyResult.Item.collaboratorEmail || streamKeyResult.Item.ownerEmail;
              console.log(`      Expected owner: ${expectedOwner || 'N/A'}`);
              
              if (expectedOwner && owner !== expectedOwner) {
                console.log(`\n      ❌ ISSUE: File is stored under wrong email!`);
                console.log(`         Should be moved from ${owner} to ${expectedOwner}`);
              } else if (expectedOwner && owner === expectedOwner) {
                console.log(`\n      ✅ File is stored under correct email`);
              }
            } else {
              console.log(`   ⚠️ StreamKey mapping NOT FOUND`);
            }
          } catch (error) {
            console.error(`   ❌ Error checking streamKey mapping:`, error.message);
          }
        }
      }
    } else {
      console.log(`⚠️ No files found`);
    }
  } catch (error) {
    console.error('❌ Error scanning files:', error.message);
  }

  console.log('\n✅ Check complete!');
}

checkLastStreamAll().catch(console.error);
