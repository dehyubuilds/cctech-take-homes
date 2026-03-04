const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugLastStream() {
  console.log('🔍 Debugging last streamed content...\n');

  // Step 1: Find the most recent files across all users
  console.log('Step 1: Finding most recent files...');
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
      // Sort by createdAt/timestamp (newest first)
      const sortedFiles = allFilesScan.Items
        .filter(f => f.createdAt || f.timestamp)
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
          const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
          return bTime - aTime;
        });

      console.log(`✅ Found ${sortedFiles.length} files with timestamps`);
      console.log(`\n📋 Most recent 10 files:`);
      
      sortedFiles.slice(0, 10).forEach((file, idx) => {
        const owner = file.PK ? file.PK.replace('USER#', '') : 'unknown';
        const time = file.createdAt || file.timestamp || 'N/A';
        console.log(`\n   [${idx + 1}] Owner: ${owner}`);
        console.log(`       fileName: ${file.fileName || 'N/A'}`);
        console.log(`       folderName: ${file.folderName || 'N/A'}, seriesName: ${file.seriesName || 'N/A'}`);
        console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`       isVisible: ${file.isVisible}, hasHls: ${!!file.hlsUrl}, hasThumbnail: ${!!file.thumbnailUrl}`);
        console.log(`       createdAt: ${time}`);
        console.log(`       category: ${file.category || 'N/A'}`);
      });

      // Check the most recent file in detail
      if (sortedFiles.length > 0) {
        const mostRecent = sortedFiles[0];
        const owner = mostRecent.PK ? mostRecent.PK.replace('USER#', '') : 'unknown';
        
        console.log(`\n🔍 DETAILED ANALYSIS OF MOST RECENT FILE:`);
        console.log(`   Owner: ${owner}`);
        console.log(`   fileName: ${mostRecent.fileName || 'N/A'}`);
        console.log(`   folderName: ${mostRecent.folderName || 'N/A'}`);
        console.log(`   seriesName: ${mostRecent.seriesName || 'N/A'}`);
        console.log(`   streamKey: ${mostRecent.streamKey || 'N/A'}`);
        console.log(`   isVisible: ${mostRecent.isVisible}`);
        console.log(`   hlsUrl: ${mostRecent.hlsUrl ? 'EXISTS' : 'MISSING'}`);
        console.log(`   thumbnailUrl: ${mostRecent.thumbnailUrl ? 'EXISTS' : 'MISSING'}`);
        console.log(`   createdAt: ${mostRecent.createdAt || mostRecent.timestamp || 'N/A'}`);
        
        // Check if streamKey mapping exists
        if (mostRecent.streamKey) {
          console.log(`\n   Checking STREAM_KEY mapping for: ${mostRecent.streamKey}`);
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
              
              // Check if email matches
              if (streamKeyResult.Item.collaboratorEmail && owner !== streamKeyResult.Item.collaboratorEmail) {
                console.log(`   ⚠️ WARNING: File owner (${owner}) doesn't match collaboratorEmail (${streamKeyResult.Item.collaboratorEmail})`);
              }
              if (streamKeyResult.Item.ownerEmail && owner !== streamKeyResult.Item.ownerEmail) {
                console.log(`   ⚠️ WARNING: File owner (${owner}) doesn't match ownerEmail (${streamKeyResult.Item.ownerEmail})`);
              }
            } else {
              console.log(`   ⚠️ StreamKey mapping NOT FOUND`);
            }
          } catch (error) {
            console.error(`   ❌ Error checking streamKey mapping:`, error.message);
          }
        }
        
        // Check if file would appear in channel content
        if (mostRecent.folderName || mostRecent.seriesName) {
          const channelName = mostRecent.folderName || mostRecent.seriesName;
          console.log(`\n   Checking if file would appear in channel: "${channelName}"`);
          
          // Check if owner is channel owner or legitimate collaborator
          console.log(`   File owner: ${owner}`);
          console.log(`   Channel name: ${channelName}`);
          
          // Try to find channel metadata to get creatorEmail
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
                  FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND channelName = :channelName AND addedViaInvite = :addedViaInvite',
                  ExpressionAttributeValues: {
                    ':pkPrefix': 'USER#',
                    ':skPrefix': 'COLLABORATOR_ROLE#',
                    ':channelName': channelName,
                    ':addedViaInvite': true
                  }
                }).promise();
                
                if (collaboratorScan.Items) {
                  const collaboratorEmails = new Set();
                  for (const role of collaboratorScan.Items) {
                    const userId = role.PK ? role.PK.replace('USER#', '') : null;
                    if (userId) {
                      // Try to get email from userId
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
                            console.log(`      Found collaborator: ${userId} -> ${email}`);
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
                }
              }
            }
          } catch (error) {
            console.error(`   ❌ Error checking channel:`, error.message);
          }
        }
      }
    } else {
      console.log(`⚠️ No files found`);
    }
  } catch (error) {
    console.error('❌ Error scanning files:', error.message);
  }

  console.log('\n✅ Debug complete!');
}

debugLastStream().catch(console.error);
