const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkLastStreamedVideo() {
  console.log('🔍 Checking last streamed video...\n');

  // Find the most recent files
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

      if (sortedFiles.length > 0) {
        const mostRecent = sortedFiles[0];
        const owner = mostRecent.PK ? mostRecent.PK.replace('USER#', '') : 'unknown';
        const time = mostRecent.createdAt || mostRecent.timestamp || 'N/A';
        const timeAgo = time !== 'N/A' ? Math.round((Date.now() - new Date(time).getTime()) / 1000 / 60) + ' minutes ago' : 'N/A';
        
        console.log(`📋 LAST STREAMED VIDEO:`);
        console.log(`   fileName: ${mostRecent.fileName || 'N/A'}`);
        console.log(`   Currently stored under: ${owner}`);
        console.log(`   Channel (folderName): ${mostRecent.folderName || 'N/A'}`);
        console.log(`   streamKey: ${mostRecent.streamKey || 'N/A'}`);
        console.log(`   uploadId: ${mostRecent.uploadId || 'N/A'}`);
        console.log(`   Created: ${time} (${timeAgo})`);
        console.log(`   isVisible: ${mostRecent.isVisible}`);
        console.log(`   hasHls: ${!!mostRecent.hlsUrl}`);
        console.log(`   hasThumbnail: ${!!mostRecent.thumbnailUrl}`);

        // Check streamKey mapping to see where it SHOULD be
        if (mostRecent.streamKey) {
          console.log(`\n🔍 Checking streamKey mapping for: ${mostRecent.streamKey}`);
          try {
            const streamKeyParams = {
              TableName: table,
              Key: {
                PK: `STREAM_KEY#${mostRecent.streamKey}`,
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
              
              // Determine where file SHOULD be stored
              const expectedOwner = streamKeyResult.Item.isCollaboratorKey 
                ? (streamKeyResult.Item.collaboratorEmail || streamKeyResult.Item.ownerEmail)
                : (streamKeyResult.Item.ownerEmail || streamKeyResult.Item.collaboratorEmail);
              
              const expectedChannel = streamKeyResult.Item.channelName || mostRecent.folderName;
              
              console.log(`\n   📊 WHERE IT SHOULD BE:`);
              console.log(`      ✅ Expected owner: ${expectedOwner || 'N/A'}`);
              console.log(`      ✅ Expected channel: ${expectedChannel || 'N/A'}`);
              
              if (expectedOwner && owner !== expectedOwner) {
                console.log(`\n   ❌ PROBLEM: File is stored under WRONG email!`);
                console.log(`      Current location: ${owner}`);
                console.log(`      Should be at: ${expectedOwner}`);
                console.log(`      This is why it's not appearing in the "${expectedChannel}" channel!`);
              } else if (expectedOwner && owner === expectedOwner) {
                console.log(`\n   ✅ CORRECT: File is stored under the correct email`);
                console.log(`      It should appear in the "${expectedChannel}" channel`);
              }
              
              // Get username from creatorId
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
                    const username = userProfile.Item.username || userProfile.Item.userName;
                    console.log(`\n   👤 Streamer info:`);
                    console.log(`      Username: ${username || 'N/A'}`);
                    console.log(`      Email: ${userProfile.Item.email || userProfile.Item.userEmail || 'N/A'}`);
                  }
                } catch (err) {
                  // Ignore
                }
              }
            } else {
              console.log(`   ❌ StreamKey mapping NOT FOUND`);
              console.log(`   This means the streamKey was not properly registered`);
            }
          } catch (error) {
            console.error(`   ❌ Error checking streamKey mapping: ${error.message}`);
          }
        }
      }
    } else {
      console.log(`⚠️ No files found`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n✅ Check complete!');
}

checkLastStreamedVideo().catch(console.error);
