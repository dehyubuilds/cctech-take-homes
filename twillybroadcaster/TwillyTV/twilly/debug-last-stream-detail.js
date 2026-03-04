const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugLastStreamDetail() {
  console.log('🔍 Detailed analysis of last stream issue...\n');

  const streamKey = 'twillytvn2xif8y2';
  const channelName = 'Twilly TV';
  const wrongOwner = 'dehyubuilds@gmail.com';
  const correctOwner = 'dehsin365@gmail.com';

  // Check streamKey mapping
  console.log('Step 1: Checking STREAM_KEY mapping...');
  try {
    const streamKeyParams = {
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    };
    const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
    
    if (streamKeyResult.Item) {
      console.log(`✅ StreamKey mapping:`);
      console.log(`   collaboratorEmail: ${streamKeyResult.Item.collaboratorEmail || 'N/A'}`);
      console.log(`   ownerEmail: ${streamKeyResult.Item.ownerEmail || 'N/A'}`);
      console.log(`   creatorId: ${streamKeyResult.Item.creatorId || 'N/A'}`);
      console.log(`   channelName: ${streamKeyResult.Item.channelName || 'N/A'}`);
      console.log(`   isCollaboratorKey: ${streamKeyResult.Item.isCollaboratorKey}`);
    } else {
      console.log(`❌ StreamKey mapping NOT FOUND`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  // Check channel owner
  console.log(`\nStep 2: Checking channel owner for "${channelName}"...`);
  try {
    const channelScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND channelName = :channelName',
      ExpressionAttributeValues: {
        ':pkPrefix': 'CHANNEL#',
        ':sk': 'METADATA',
        ':channelName': channelName
      }
    }).promise();

    if (channelScan.Items && channelScan.Items.length > 0) {
      const channel = channelScan.Items[0];
      const channelOwner = channel.creatorEmail || channel.PK.replace('CHANNEL#', '').split('-')[0];
      console.log(`✅ Channel owner: ${channelOwner}`);
      console.log(`   Channel ID: ${channel.PK.replace('CHANNEL#', '')}`);
    } else {
      console.log(`⚠️ Channel metadata not found`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  // Check if dehsin365@gmail.com is a legitimate collaborator
  console.log(`\nStep 3: Checking if ${correctOwner} is a legitimate collaborator...`);
  try {
    const userId = 'f6ff9d4d-fb19-425c-94cb-617a9ee6f7fc'; // From streamKey mapping
    
    const collaboratorCheck = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: `COLLABORATOR_ROLE#${channelName}`
      }
    }).promise();

    if (collaboratorCheck.Item) {
      console.log(`✅ Collaborator role found:`);
      console.log(`   addedViaInvite: ${collaboratorCheck.Item.addedViaInvite}`);
      console.log(`   status: ${collaboratorCheck.Item.status || 'N/A'}`);
      console.log(`   channelName: ${collaboratorCheck.Item.channelName || 'N/A'}`);
    } else {
      console.log(`❌ Collaborator role NOT FOUND`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  // Check files under wrong owner
  console.log(`\nStep 4: Checking files under wrong owner (${wrongOwner})...`);
  try {
    const wrongOwnerFiles = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'streamKey = :streamKey',
      ExpressionAttributeValues: {
        ':pk': `USER#${wrongOwner}`,
        ':skPrefix': 'FILE#',
        ':streamKey': streamKey
      }
    }).promise();

    if (wrongOwnerFiles.Items && wrongOwnerFiles.Items.length > 0) {
      console.log(`⚠️ Found ${wrongOwnerFiles.Items.length} file(s) under WRONG owner:`);
      wrongOwnerFiles.Items.forEach((file, idx) => {
        console.log(`   [${idx + 1}] ${file.fileName || 'N/A'}`);
        console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
        console.log(`       isVisible: ${file.isVisible}, hasHls: ${!!file.hlsUrl}`);
      });
    } else {
      console.log(`✅ No files found under wrong owner`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  // Check files under correct owner
  console.log(`\nStep 5: Checking files under correct owner (${correctOwner})...`);
  try {
    const correctOwnerFiles = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'streamKey = :streamKey',
      ExpressionAttributeValues: {
        ':pk': `USER#${correctOwner}`,
        ':skPrefix': 'FILE#',
        ':streamKey': streamKey
      }
    }).promise();

    if (correctOwnerFiles.Items && correctOwnerFiles.Items.length > 0) {
      console.log(`✅ Found ${correctOwnerFiles.Items.length} file(s) under CORRECT owner:`);
      correctOwnerFiles.Items.forEach((file, idx) => {
        console.log(`   [${idx + 1}] ${file.fileName || 'N/A'}`);
        console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
        console.log(`       isVisible: ${file.isVisible}, hasHls: ${!!file.hlsUrl}`);
      });
    } else {
      console.log(`⚠️ No files found under correct owner`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  // Check what get-content would return
  console.log(`\nStep 6: Simulating get-content query for "${channelName}"...`);
  try {
    // First find channel owner
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

    let creatorEmail = null;
    if (channelScan.Items && channelScan.Items.length > 0) {
      creatorEmail = channelScan.Items[0].creatorEmail || channelScan.Items[0].PK.replace('CHANNEL#', '').split('-')[0];
      console.log(`   Channel owner: ${creatorEmail}`);
    }

    if (creatorEmail) {
      // Find legitimate collaborators
      const collaboratorScan = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND (channelId = :channelId OR channelName = :channelName) AND addedViaInvite = :addedViaInvite AND status = :status',
        ExpressionAttributeValues: {
          ':pkPrefix': 'USER#',
          ':skPrefix': 'COLLABORATOR_ROLE#',
          ':channelId': channelName,
          ':channelName': channelName,
          ':addedViaInvite': true,
          ':status': 'active'
        }
      }).promise();

      const collaboratorEmails = new Set([creatorEmail]);
      if (collaboratorScan.Items) {
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
                  console.log(`   Legitimate collaborator: ${email}`);
                }
              }
            } catch (err) {
              // Ignore
            }
          }
        }
      }

      console.log(`\n   Files that get-content would query from:`);
      console.log(`   ${Array.from(collaboratorEmails).join(', ')}`);

      // Check if wrong owner is in the list
      if (collaboratorEmails.has(wrongOwner)) {
        console.log(`   ⚠️ WARNING: Wrong owner (${wrongOwner}) is in the list - file might appear`);
      } else {
        console.log(`   ❌ Wrong owner (${wrongOwner}) is NOT in the list - file will NOT appear`);
      }

      // Check if correct owner is in the list
      if (collaboratorEmails.has(correctOwner)) {
        console.log(`   ✅ Correct owner (${correctOwner}) is in the list - file should appear`);
      } else {
        console.log(`   ❌ Correct owner (${correctOwner}) is NOT in the list - file will NOT appear`);
      }
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  console.log('\n✅ Analysis complete!');
}

debugLastStreamDetail().catch(console.error);
