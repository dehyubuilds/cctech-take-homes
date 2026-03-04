const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function verifyGetContent() {
  console.log('🔍 Verifying get-content logic for "Twilly TV"...\n');

  const channelName = 'Twilly TV';
  const creatorEmail = 'dehyu.sinyan@gmail.com'; // Channel owner

  // Step 1: Find channel ID
  console.log('Step 1: Finding channel ID...');
  let channelId = null;
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
      channelId = channelScan.Items[0].channelId || channelScan.Items[0].PK.replace('CHANNEL#', '');
      console.log(`✅ Channel ID: ${channelId}`);
    } else {
      channelId = channelName;
      console.log(`⚠️ Using channelName as channelId: ${channelId}`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    channelId = channelName;
  }

  // Step 2: Find legitimate collaborators
  console.log(`\nStep 2: Finding legitimate collaborators...`);
  const legitimateCollaboratorUserIds = new Set();
  try {
    const possibleChannelIds = [channelId, channelName];
    
    for (const possibleId of possibleChannelIds) {
      const collaboratorScan = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND (channelId = :channelId OR channelName = :channelName) AND addedViaInvite = :addedViaInvite AND status = :status',
        ExpressionAttributeValues: {
          ':pkPrefix': 'USER#',
          ':skPrefix': 'COLLABORATOR_ROLE#',
          ':channelId': possibleId,
          ':channelName': channelName,
          ':addedViaInvite': true,
          ':status': 'active'
        }
      }).promise();
      
      if (collaboratorScan.Items) {
        collaboratorScan.Items.forEach(role => {
          const userId = role.PK ? role.PK.replace('USER#', '') : null;
          if (userId) {
            legitimateCollaboratorUserIds.add(userId);
            console.log(`   ✅ Found collaborator: ${userId}`);
          }
        });
      }
    }
    
    console.log(`✅ Total legitimate collaborators: ${legitimateCollaboratorUserIds.size}`);
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  // Step 3: Map userIds to emails
  console.log(`\nStep 3: Mapping userIds to emails...`);
  const collaboratorEmails = new Set([creatorEmail]); // Always include owner
  for (const userId of legitimateCollaboratorUserIds) {
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
          console.log(`   ✅ ${userId} -> ${email}`);
        }
      }
    } catch (error) {
      // Ignore
    }
  }

  console.log(`\n✅ Emails that get-content will query from:`);
  console.log(`   ${Array.from(collaboratorEmails).join(', ')}`);

  // Step 4: Query files from all users
  console.log(`\nStep 4: Querying files from all users...`);
  const allFiles = [];
  for (const email of collaboratorEmails) {
    try {
      const fileQuery = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${email}`,
          ':skPrefix': 'FILE#'
        }
      }).promise();

      if (fileQuery.Items && fileQuery.Items.length > 0) {
        console.log(`   ✅ Found ${fileQuery.Items.length} files for ${email}`);
        allFiles.push(...fileQuery.Items);
      }
    } catch (error) {
      console.error(`   ❌ Error querying ${email}:`, error.message);
    }
  }

  // Step 5: Filter by channel name
  console.log(`\nStep 5: Filtering files for channel "${channelName}"...`);
  const channelFiles = allFiles.filter(file => {
    const fileChannelName = file.folderName || file.seriesName;
    const matchesChannel = fileChannelName === channelName;
    const isVisible = file.isVisible !== false;
    const hasContent = file.fileName && !file.isFolder;
    const hasHls = file.hlsUrl && !file.hlsUrl.isEmpty;
    
    if (matchesChannel && isVisible && hasContent && hasHls) {
      return true;
    }
    
    if (fileChannelName === channelName && !matchesChannel) {
      console.log(`   ⚠️ Channel name mismatch: "${fileChannelName}" vs "${channelName}"`);
    }
    
    return false;
  });

  console.log(`✅ Found ${channelFiles.length} visible files for "${channelName}"`);

  // Sort by date (newest first)
  const sortedFiles = channelFiles.sort((a, b) => {
    const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
    const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
    return bTime - aTime;
  });

  console.log(`\n📋 Files that will appear in channel view (newest first):`);
  sortedFiles.slice(0, 5).forEach((file, idx) => {
    const owner = file.PK ? file.PK.replace('USER#', '') : 'unknown';
    console.log(`   [${idx + 1}] ${file.fileName || 'N/A'}`);
    console.log(`       Owner: ${owner}`);
    console.log(`       Created: ${file.createdAt || file.timestamp || 'N/A'}`);
    console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
  });

  // Check if the most recent file (that we just moved) is in the list
  const mostRecentFile = sortedFiles[0];
  if (mostRecentFile) {
    const owner = mostRecentFile.PK ? mostRecentFile.PK.replace('USER#', '') : 'unknown';
    console.log(`\n✅ Most recent file:`);
    console.log(`   Owner: ${owner}`);
    console.log(`   fileName: ${mostRecentFile.fileName}`);
    console.log(`   streamKey: ${mostRecentFile.streamKey || 'N/A'}`);
    
    if (owner === 'dehsin365@gmail.com') {
      console.log(`   ✅ File is under correct owner - will appear in channel view`);
    } else {
      console.log(`   ⚠️ File is under ${owner} - checking if this is correct...`);
    }
  }

  console.log('\n✅ Verification complete!');
}

verifyGetContent().catch(console.error);
