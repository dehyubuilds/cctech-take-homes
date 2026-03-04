const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkTacoTuesdayStream() {
  console.log('🔍 Checking last stream to Taco Tuesday...\n');

  // Find the most recent files for Taco Tuesday
  try {
    const allFilesScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND (folderName = :channelName OR seriesName = :channelName)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#',
        ':channelName': 'Taco Tuesday🌮'
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

      console.log(`✅ Found ${sortedFiles.length} files for "Taco Tuesday🌮"`);
      
      if (sortedFiles.length > 0) {
        const mostRecent = sortedFiles[0];
        const owner = mostRecent.PK ? mostRecent.PK.replace('USER#', '') : 'unknown';
        const time = mostRecent.createdAt || mostRecent.timestamp || 'N/A';
        const timeAgo = time !== 'N/A' ? Math.round((Date.now() - new Date(time).getTime()) / 1000 / 60) + ' minutes ago' : 'N/A';
        
        console.log(`\n📋 MOST RECENT STREAM:`);
        console.log(`   fileName: ${mostRecent.fileName || 'N/A'}`);
        console.log(`   Owner: ${owner}`);
        console.log(`   streamKey: ${mostRecent.streamKey || 'N/A'}`);
        console.log(`   uploadId: ${mostRecent.uploadId || 'N/A'}`);
        console.log(`   Created: ${time} (${timeAgo})`);
        console.log(`   isVisible: ${mostRecent.isVisible}`);
        console.log(`   hasHls: ${!!mostRecent.hlsUrl}`);
        console.log(`   hasThumbnail: ${!!mostRecent.thumbnailUrl}`);
        
        // Check streamKey mapping
        if (mostRecent.streamKey) {
          console.log(`\n🔍 Checking streamKey mapping...`);
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
              console.log(`      creatorId: ${streamKeyResult.Item.creatorId || 'N/A'}`);
              console.log(`      channelName: ${streamKeyResult.Item.channelName || 'N/A'}`);
              console.log(`      isCollaboratorKey: ${streamKeyResult.Item.isCollaboratorKey}`);
              
              // Get username
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
                    console.log(`      Username: ${username || 'N/A'}`);
                  }
                } catch (err) {
                  // Ignore
                }
              }
            }
          } catch (error) {
            console.error(`   ❌ Error: ${error.message}`);
          }
        }
      }
    } else {
      console.log(`⚠️ No files found for "Taco Tuesday🌮"`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n✅ Check complete!');
}

checkTacoTuesdayStream().catch(console.error);
