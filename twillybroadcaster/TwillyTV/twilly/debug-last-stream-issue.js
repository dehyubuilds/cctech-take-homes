const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugLastStreamIssue() {
  console.log('🔍 Debugging why last stream is not appearing...\n');
  
  try {
    // Find the most recent video
    const allFilesScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND category = :category',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#',
        ':category': 'Videos'
      }
    }).promise();

    if (!allFilesScan.Items || allFilesScan.Items.length === 0) {
      console.log('❌ No videos found');
      return;
    }

    // Sort by timestamp (newest first)
    const sortedFiles = allFilesScan.Items
      .filter(f => f.createdAt || f.timestamp)
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
        const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
        return bTime - aTime;
      });

    const latestVideo = sortedFiles[0];
    const videoOwnerEmail = latestVideo.PK.replace('USER#', '');
    const channelName = latestVideo.folderName || latestVideo.seriesName;
    
    console.log('📹 MOST RECENT VIDEO:');
    console.log('='.repeat(70));
    console.log(`fileName: ${latestVideo.fileName || 'MISSING'}`);
    console.log(`streamKey: ${latestVideo.streamKey || 'MISSING'}`);
    console.log(`channelName: ${channelName || 'MISSING'}`);
    console.log(`Stored under: ${videoOwnerEmail}`);
    console.log(`isVisible: ${latestVideo.isVisible}`);
    console.log(`hlsUrl: ${latestVideo.hlsUrl ? '✅' : '❌'}`);
    console.log(`thumbnailUrl: ${latestVideo.thumbnailUrl ? '✅' : '❌'}`);
    console.log(`createdAt: ${latestVideo.createdAt || latestVideo.timestamp || 'MISSING'}`);
    console.log('');

    // Find channel owner
    console.log('🔍 FINDING CHANNEL OWNER:');
    console.log('='.repeat(70));
    let channelOwnerEmail = null;
    
    try {
      // Try to find channel by name
      const channelScan = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND channelName = :channelName AND #role = :role',
        ExpressionAttributeNames: {
          '#role': 'role'
        },
        ExpressionAttributeValues: {
          ':pkPrefix': 'CHANNEL#',
          ':channelName': channelName,
          ':role': 'owner'
        }
      }).promise();

      if (channelScan.Items && channelScan.Items.length > 0) {
        channelOwnerEmail = channelScan.Items[0].creatorEmail || channelScan.Items[0].userEmail;
        console.log(`✅ Found channel owner: ${channelOwnerEmail}`);
      } else {
        console.log(`⚠️ Channel not found, trying alternative lookup...`);
        
        // Try to find by scanning for files with same channel name
        const ownerFiles = sortedFiles.filter(f => 
          (f.folderName === channelName || f.seriesName === channelName) &&
          f.PK
        );
        
        if (ownerFiles.length > 0) {
          // Get unique owner emails
          const ownerEmails = [...new Set(ownerFiles.map(f => f.PK.replace('USER#', '')))];
          console.log(`Found ${ownerEmails.length} potential owners: ${ownerEmails.join(', ')}`);
          
          // For Twilly TV, the owner is likely dehyu.sinyan@gmail.com
          if (channelName === 'Twilly TV') {
            channelOwnerEmail = 'dehyu.sinyan@gmail.com';
            console.log(`Using known owner for Twilly TV: ${channelOwnerEmail}`);
          } else {
            channelOwnerEmail = ownerEmails[0];
            console.log(`Using first owner found: ${channelOwnerEmail}`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error finding channel owner: ${error.message}`);
    }
    
    console.log('');

    // Check if video would be found by get-content API
    console.log('📡 GET-CONTENT API SIMULATION:');
    console.log('='.repeat(70));
    console.log(`Channel name: ${channelName}`);
    console.log(`Channel owner (creatorEmail): ${channelOwnerEmail || 'UNKNOWN'}`);
    console.log(`Video stored under: ${videoOwnerEmail}`);
    console.log(`Match: ${videoOwnerEmail === channelOwnerEmail ? '✅ YES' : '❌ NO'}`);
    console.log('');

    if (videoOwnerEmail !== channelOwnerEmail) {
      console.log('🚨 ISSUE FOUND:');
      console.log('='.repeat(70));
      console.log(`The video is stored under ${videoOwnerEmail}`);
      console.log(`But get-content API only queries from ${channelOwnerEmail || 'channel owner'}`);
      console.log(`This is why the video is not appearing!`);
      console.log('');
      console.log('💡 SOLUTION:');
      console.log('The video needs to be stored under the channel owner account,');
      console.log('OR the get-content API needs to also query from collaborator accounts.');
      console.log('');
      
      // Check if this is a collaborator video
      if (latestVideo.streamKey) {
        try {
          const streamKeyParams = {
            TableName: table,
            Key: {
              PK: `STREAM_KEY#${latestVideo.streamKey}`,
              SK: 'MAPPING'
            }
          };
          
          const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
          
          if (streamKeyResult.Item) {
            const mapping = streamKeyResult.Item;
            console.log('🔑 STREAM KEY INFO:');
            console.log(`   isCollaboratorKey: ${mapping.isCollaboratorKey || false}`);
            console.log(`   collaboratorEmail: ${mapping.collaboratorEmail || 'N/A'}`);
            console.log(`   ownerEmail: ${mapping.ownerEmail || 'N/A'}`);
            console.log(`   creatorId: ${mapping.creatorId || 'N/A'}`);
            console.log('');
            
            if (mapping.isCollaboratorKey) {
              console.log('💡 This is a collaborator video.');
              console.log('   The get-content API should query from collaborator accounts too,');
              console.log('   OR the video should be stored under the master account.');
            }
          }
        } catch (error) {
          console.error(`Error checking stream key: ${error.message}`);
        }
      }
    } else {
      console.log('✅ Video is stored under correct account.');
      console.log('Checking other potential issues...');
      console.log('');
      
      // Check all get-content filtering criteria
      const checks = {
        hasValidThumbnail: latestVideo.thumbnailUrl && 
                          typeof latestVideo.thumbnailUrl === 'string' && 
                          latestVideo.thumbnailUrl.trim() !== '' &&
                          latestVideo.thumbnailUrl !== 'null' &&
                          latestVideo.thumbnailUrl !== 'undefined' &&
                          (latestVideo.thumbnailUrl.startsWith('http://') || latestVideo.thumbnailUrl.startsWith('https://')),
        hasHlsUrl: !!latestVideo.hlsUrl,
        hasStreamKey: !!latestVideo.streamKey,
        isVisible: latestVideo.isVisible === true,
        channelMatch: (latestVideo.folderName === channelName || latestVideo.seriesName === channelName),
        hasUsername: false // Will check below
      };
      
      console.log('🔍 FILTERING CHECKS:');
      console.log('='.repeat(70));
      Object.entries(checks).forEach(([key, value]) => {
        console.log(`${key}: ${value ? '✅' : '❌'}`);
      });
      
      // Check username
      if (latestVideo.streamKey) {
        try {
          const streamKeyParams = {
            TableName: table,
            Key: {
              PK: `STREAM_KEY#${latestVideo.streamKey}`,
              SK: 'MAPPING'
            }
          };
          
          const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
          
          if (streamKeyResult.Item && streamKeyResult.Item.creatorId) {
            // Check source of truth
            const userParams = {
              TableName: table,
              Key: {
                PK: 'USER',
                SK: streamKeyResult.Item.creatorId
              }
            };
            
            const userResult = await dynamodb.get(userParams).promise();
            if (userResult.Item && userResult.Item.username) {
              checks.hasUsername = true;
              console.log(`hasUsername: ✅ (${userResult.Item.username})`);
            } else {
              console.log(`hasUsername: ❌ (no username found for creatorId: ${streamKeyResult.Item.creatorId})`);
            }
          }
        } catch (error) {
          console.log(`hasUsername: ❌ (error: ${error.message})`);
        }
      }
      
      const allPass = Object.values(checks).every(v => v === true);
      console.log('');
      console.log(`${allPass ? '✅' : '❌'} All checks: ${allPass ? 'PASS' : 'FAIL'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

debugLastStreamIssue().catch(console.error);
