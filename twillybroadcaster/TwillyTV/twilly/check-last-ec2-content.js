const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkLastEC2Content() {
  console.log('🔍 Checking last streamed content from EC2...\n');

  // Find the most recent files (sorted by createdAt)
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
      
      if (sortedFiles.length > 0) {
        const mostRecent = sortedFiles[0];
        const owner = mostRecent.PK ? mostRecent.PK.replace('USER#', '') : 'unknown';
        const time = mostRecent.createdAt || mostRecent.timestamp || 'N/A';
        const timeAgo = time !== 'N/A' ? Math.round((Date.now() - new Date(time).getTime()) / 1000 / 60) + ' minutes ago' : 'N/A';
        
        console.log(`\n📋 MOST RECENT STREAM:`);
        console.log(`   fileName: ${mostRecent.fileName || 'N/A'}`);
        console.log(`   Currently stored under: ${owner}`);
        console.log(`   folderName: ${mostRecent.folderName || 'N/A'}`);
        console.log(`   streamKey: ${mostRecent.streamKey || 'N/A'}`);
        console.log(`   uploadId: ${mostRecent.uploadId || 'N/A'}`);
        console.log(`   Created: ${time} (${timeAgo})`);
        console.log(`   isVisible: ${mostRecent.isVisible}`);
        console.log(`   hasHls: ${!!mostRecent.hlsUrl}`);
        console.log(`   hasThumbnail: ${!!mostRecent.thumbnailUrl}`);

        // Check streamKey mapping
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
              
              console.log(`\n   📊 WHERE FILE SHOULD BE:`);
              console.log(`      Expected owner: ${expectedOwner || 'N/A'}`);
              console.log(`      Expected channel: ${streamKeyResult.Item.channelName || mostRecent.folderName || 'N/A'}`);
              
              if (expectedOwner && owner !== expectedOwner) {
                console.log(`\n   ❌ PROBLEM: File is stored under WRONG email!`);
                console.log(`      Current: ${owner}`);
                console.log(`      Should be: ${expectedOwner}`);
                console.log(`      This is why it's not appearing in the channel!`);
              } else if (expectedOwner && owner === expectedOwner) {
                console.log(`\n   ✅ File is stored under correct email`);
              }
              
              // Check if file would appear in channel
              const channelName = streamKeyResult.Item.channelName || mostRecent.folderName;
              if (channelName) {
                console.log(`\n   🔍 Checking if file would appear in channel "${channelName}"...`);
                
                // Check channel owner
                try {
                  const channelScan = await dynamodb.scan({
                    TableName: table,
                    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND channelName = :channelName',
                    ExpressionAttributeValues: {
                      ':pkPrefix': 'CHANNEL#',
                      ':sk': 'METADATA',
                      ':channelName': channelName
                    },
                    Limit: 1
                  }).promise();

                  if (channelScan.Items && channelScan.Items.length > 0) {
                    const channelOwner = channelScan.Items[0].creatorEmail || channelScan.Items[0].PK.replace('CHANNEL#', '').split('-')[0];
                    console.log(`      Channel owner: ${channelOwner}`);
                    
                    // Check if file owner is channel owner or legitimate collaborator
                    const fileOwner = owner;
                    if (fileOwner === channelOwner) {
                      console.log(`      ✅ File owner matches channel owner - should appear`);
                    } else {
                      console.log(`      ⚠️ File owner doesn't match channel owner - checking if collaborator...`);
                      
                      // Check if file owner is a legitimate collaborator
                      if (streamKeyResult.Item.creatorId) {
                        try {
                          const collaboratorCheck = await dynamodb.get({
                            TableName: table,
                            Key: {
                              PK: `USER#${streamKeyResult.Item.creatorId}`,
                              SK: `COLLABORATOR_ROLE#${channelName}`
                            }
                          }).promise();
                          
                          if (collaboratorCheck.Item && collaboratorCheck.Item.addedViaInvite === true) {
                            console.log(`      ✅ File owner is a legitimate collaborator (addedViaInvite: true)`);
                            console.log(`      ✅ File should appear in channel`);
                            
                            // But wait - is the file under the right email?
                            // Get email from creatorId
                            try {
                              const userProfile = await dynamodb.get({
                                TableName: table,
                                Key: {
                                  PK: `USER#${streamKeyResult.Item.creatorId}`,
                                  SK: 'PROFILE'
                                }
                              }).promise();
                              
                              if (userProfile.Item) {
                                const collaboratorEmail = userProfile.Item.email || userProfile.Item.userEmail;
                                console.log(`      Collaborator email from profile: ${collaboratorEmail}`);
                                
                                if (fileOwner === collaboratorEmail) {
                                  console.log(`      ✅ File is under correct collaborator email - should appear`);
                                } else {
                                  console.log(`      ❌ File is under ${fileOwner} but should be under ${collaboratorEmail}`);
                                  console.log(`      ❌ This is why it's not appearing!`);
                                }
                              }
                            } catch (err) {
                              console.log(`      ⚠️ Could not get collaborator email from profile`);
                            }
                          } else {
                            console.log(`      ❌ File owner is NOT a legitimate collaborator`);
                            console.log(`      ❌ File will NOT appear in channel`);
                          }
                        } catch (err) {
                          console.log(`      ⚠️ Error checking collaborator role: ${err.message}`);
                        }
                      }
                    }
                  }
                } catch (error) {
                  console.error(`      ❌ Error checking channel: ${error.message}`);
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

checkLastEC2Content().catch(console.error);
