const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkLastEC2Stream() {
  console.log('🔍 Checking last stream from EC2 instance...\n');

  // Step 1: Find the most recent file with uploadId (indicates EC2 upload)
  console.log('Step 1: Finding most recent files with uploadId...');
  try {
    const allFilesScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND attribute_exists(uploadId)',
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

      console.log(`✅ Found ${sortedFiles.length} files with uploadId`);
      
      if (sortedFiles.length > 0) {
        const mostRecent = sortedFiles[0];
        const owner = mostRecent.PK ? mostRecent.PK.replace('USER#', '') : 'unknown';
        
        console.log(`\n📋 MOST RECENT STREAM:`);
        console.log(`   Owner (PK): ${owner}`);
        console.log(`   fileName: ${mostRecent.fileName || 'N/A'}`);
        console.log(`   folderName: ${mostRecent.folderName || 'N/A'}`);
        console.log(`   streamKey: ${mostRecent.streamKey || 'N/A'}`);
        console.log(`   uploadId: ${mostRecent.uploadId || 'N/A'}`);
        console.log(`   createdAt: ${mostRecent.createdAt || mostRecent.timestamp || 'N/A'}`);
        console.log(`   isVisible: ${mostRecent.isVisible}`);
        console.log(`   hlsUrl: ${mostRecent.hlsUrl ? 'EXISTS' : 'MISSING'}`);
        console.log(`   thumbnailUrl: ${mostRecent.thumbnailUrl ? 'EXISTS' : 'MISSING'}`);

        // Step 2: Check streamKey mapping
        if (mostRecent.streamKey) {
          console.log(`\nStep 2: Checking STREAM_KEY mapping for: ${mostRecent.streamKey}`);
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
              console.log(`✅ StreamKey mapping found:`);
              console.log(`   collaboratorEmail: ${streamKeyResult.Item.collaboratorEmail || 'N/A'}`);
              console.log(`   ownerEmail: ${streamKeyResult.Item.ownerEmail || 'N/A'}`);
              console.log(`   creatorId: ${streamKeyResult.Item.creatorId || 'N/A'}`);
              console.log(`   channelName: ${streamKeyResult.Item.channelName || 'N/A'}`);
              console.log(`   isCollaboratorKey: ${streamKeyResult.Item.isCollaboratorKey}`);
              
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
                    console.log(`\n   ✅ Username from creatorId: ${username || 'N/A'}`);
                  }
                } catch (err) {
                  console.log(`   ⚠️ Could not get username from creatorId: ${err.message}`);
                }
              }
              
              // Check if file owner matches expected owner
              const expectedOwner = streamKeyResult.Item.collaboratorEmail || streamKeyResult.Item.ownerEmail;
              if (expectedOwner && owner !== expectedOwner) {
                console.log(`\n   ⚠️ MISMATCH: File is under ${owner}, but should be under ${expectedOwner}`);
              } else if (expectedOwner && owner === expectedOwner) {
                console.log(`\n   ✅ File owner matches expected owner`);
              }
              
              // Summary
              console.log(`\n📊 SUMMARY:`);
              console.log(`   Username should be: ${username || 'N/A (check creatorId: ' + (streamKeyResult.Item.creatorId || 'N/A') + ')'}`);
              console.log(`   Channel should be: ${streamKeyResult.Item.channelName || mostRecent.folderName || 'N/A'}`);
              console.log(`   File is currently under: ${owner}`);
              console.log(`   Expected owner: ${expectedOwner || 'N/A'}`);
              
              if (expectedOwner && owner !== expectedOwner) {
                console.log(`\n   ❌ ISSUE: File is stored under wrong email!`);
                console.log(`      Should be moved from ${owner} to ${expectedOwner}`);
              }
            } else {
              console.log(`⚠️ StreamKey mapping NOT FOUND`);
              console.log(`   This means the streamKey was not properly registered`);
            }
          } catch (error) {
            console.error(`❌ Error checking streamKey mapping:`, error.message);
          }
        }

        // Step 3: Check if file would appear in channel
        const channelName = mostRecent.folderName || mostRecent.seriesName;
        if (channelName) {
          console.log(`\nStep 3: Checking if file would appear in channel "${channelName}"...`);
          
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
              console.log(`   Channel owner: ${channelOwner}`);
              
              if (owner === channelOwner) {
                console.log(`   ✅ File owner matches channel owner - should appear`);
              } else {
                console.log(`   ⚠️ File owner doesn't match channel owner - checking if collaborator...`);
                
                // Check if owner is a legitimate collaborator
                const collaboratorScan = await dynamodb.scan({
                  TableName: table,
                  FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND channelName = :channelName AND addedViaInvite = :addedViaInvite AND #status = :status',
                  ExpressionAttributeNames: {
                    '#status': 'status'
                  },
                  ExpressionAttributeValues: {
                    ':pkPrefix': 'USER#',
                    ':skPrefix': 'COLLABORATOR_ROLE#',
                    ':channelName': channelName,
                    ':addedViaInvite': true,
                    ':status': 'active'
                  }
                }).promise();
                
                if (collaboratorScan.Items && collaboratorScan.Items.length > 0) {
                  const collaboratorEmails = new Set();
                  for (const role of collaboratorScan.Items) {
                    const userId = role.PK ? role.PK.replace('USER#', '') : null;
                    if (userId) {
                      try {
                        const userProfile = await dynamodb.get({
                          TableName: table,
                          Key: {
                            PK: `USER#${userId}`,
                            SK: 'PROFILE'
                          }
                        }).promise();
                        
                        if (userProfile.Item) {
                          const email = userProfile.Item.email || userProfile.Item.userEmail;
                          if (email) {
                            collaboratorEmails.add(email);
                            console.log(`      Found collaborator: ${email}`);
                          }
                        }
                      } catch (err) {
                        // Ignore
                      }
                    }
                  }
                  
                  if (collaboratorEmails.has(owner)) {
                    console.log(`   ✅ File owner is a legitimate collaborator - should appear`);
                  } else {
                    console.log(`   ❌ File owner is NOT a legitimate collaborator - will NOT appear`);
                    console.log(`      Legitimate collaborators: ${Array.from(collaboratorEmails).join(', ')}`);
                  }
                } else {
                  console.log(`   ⚠️ No collaborators found for this channel`);
                }
              }
            }
          } catch (error) {
            console.error(`   ❌ Error checking channel:`, error.message);
          }
        }
      }
    } else {
      console.log(`⚠️ No files found with uploadId`);
    }
  } catch (error) {
    console.error('❌ Error scanning files:', error.message);
  }

  console.log('\n✅ Check complete!');
}

checkLastEC2Stream().catch(console.error);
