const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function verifyFileInChannel() {
  console.log('🔍 Verifying file will appear in channel view...\n');

  const streamKey = 'twillyafterdark5zm836l5';
  const channelName = 'Twilly After Dark';
  const expectedOwner = 'dehsin365@gmail.com';

  // Step 1: Check if file exists under correct owner
  console.log('Step 1: Checking if file exists under correct owner...');
  try {
    const fileQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'streamKey = :streamKey',
      ExpressionAttributeValues: {
        ':pk': `USER#${expectedOwner}`,
        ':skPrefix': 'FILE#',
        ':streamKey': streamKey
      }
    }).promise();

    if (fileQuery.Items && fileQuery.Items.length > 0) {
      const file = fileQuery.Items[0];
      console.log(`   ✅ File found:`);
      console.log(`      fileName: ${file.fileName}`);
      console.log(`      folderName: ${file.folderName}`);
      console.log(`      isVisible: ${file.isVisible}`);
      console.log(`      hasHls: ${!!file.hlsUrl}`);
      console.log(`      createdAt: ${file.createdAt || file.timestamp}`);
    } else {
      console.log(`   ❌ File NOT found under ${expectedOwner}`);
      return;
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return;
  }

  // Step 2: Check if owner is a legitimate collaborator
  console.log(`\nStep 2: Checking if ${expectedOwner} is a legitimate collaborator...`);
  try {
    // Find channel owner
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

    let channelOwner = null;
    if (channelScan.Items && channelScan.Items.length > 0) {
      channelOwner = channelScan.Items[0].creatorEmail || channelScan.Items[0].PK.replace('CHANNEL#', '').split('-')[0];
      console.log(`   Channel owner: ${channelOwner}`);
    }

    // Check if expectedOwner is channel owner
    if (expectedOwner === channelOwner) {
      console.log(`   ✅ ${expectedOwner} is the channel owner - file will appear`);
      return;
    }

    // Check if expectedOwner is a legitimate collaborator
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
      const collaboratorUserIds = new Set();
      for (const role of collaboratorScan.Items) {
        const userId = role.PK ? role.PK.replace('USER#', '') : null;
        if (userId) {
          collaboratorUserIds.add(userId);
        }
      }

      // Map userIds to emails (with fallback to streamKey mappings)
      const collaboratorEmails = new Set([channelOwner]);
      for (const userId of collaboratorUserIds) {
        let email = null;
        
        // Try user profile first
        try {
          const userProfile = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `USER#${userId}`,
              SK: 'PROFILE'
            }
          }).promise();

          if (userProfile.Item) {
            email = userProfile.Item.email || userProfile.Item.userEmail;
          }
        } catch (err) {
          // Ignore
        }
        
        // Fallback: Check streamKey mappings for this creatorId
        if (!email) {
          try {
            const streamKeyScan = await dynamodb.scan({
              TableName: table,
              FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND creatorId = :creatorId',
              ExpressionAttributeValues: {
                ':pkPrefix': 'STREAM_KEY#',
                ':sk': 'MAPPING',
                ':creatorId': userId
              },
              Limit: 1
            }).promise();
            
            if (streamKeyScan.Items && streamKeyScan.Items.length > 0) {
              email = streamKeyScan.Items[0].collaboratorEmail || streamKeyScan.Items[0].ownerEmail;
              console.log(`   Found email via streamKey mapping fallback: ${userId} -> ${email}`);
            }
          } catch (err) {
            // Ignore
          }
        }
        
        if (email) {
          collaboratorEmails.add(email);
          console.log(`   Found collaborator: ${userId} -> ${email}`);
        } else {
          console.log(`   ⚠️ Could not find email for userId: ${userId}`);
        }
      }

      if (collaboratorEmails.has(expectedOwner)) {
        console.log(`   ✅ ${expectedOwner} is a legitimate collaborator - file will appear`);
        console.log(`   ✅ get-content will query from: ${Array.from(collaboratorEmails).join(', ')}`);
      } else {
        console.log(`   ❌ ${expectedOwner} is NOT a legitimate collaborator - file will NOT appear`);
        console.log(`   Legitimate collaborators: ${Array.from(collaboratorEmails).join(', ')}`);
      }
    } else {
      console.log(`   ⚠️ No collaborators found for this channel`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }

  console.log('\n✅ Verification complete!');
}

verifyFileInChannel().catch(console.error);
