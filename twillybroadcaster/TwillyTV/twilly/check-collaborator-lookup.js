const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkCollaboratorLookup() {
  console.log('🔍 Checking collaborator lookup for "Twilly TV"...\n');

  const channelName = 'Twilly TV';
  const userId = 'f6ff9d4d-fb19-425c-94cb-617a9ee6f7fc'; // dehswizzy's userId

  // Check if collaborator role exists
  console.log('Step 1: Checking if collaborator role exists...');
  try {
    const roleCheck = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: `COLLABORATOR_ROLE#${channelName}`
      }
    }).promise();

    if (roleCheck.Item) {
      console.log(`✅ Collaborator role found:`);
      console.log(`   channelName: ${roleCheck.Item.channelName}`);
      console.log(`   channelId: ${roleCheck.Item.channelId || 'N/A'}`);
      console.log(`   addedViaInvite: ${roleCheck.Item.addedViaInvite}`);
      console.log(`   status: ${roleCheck.Item.status || 'N/A'}`);
    } else {
      console.log(`❌ Collaborator role NOT FOUND`);
      console.log(`   Looking for: PK=USER#${userId}, SK=COLLABORATOR_ROLE#${channelName}`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  // Try the scan with ExpressionAttributeNames (fixed version)
  console.log(`\nStep 2: Testing scan with ExpressionAttributeNames (fixed version)...`);
  try {
    const collaboratorScanParams = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND (channelId = :channelId OR channelName = :channelName) AND addedViaInvite = :addedViaInvite AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'COLLABORATOR_ROLE#',
        ':channelId': channelName,
        ':channelName': channelName,
        ':addedViaInvite': true,
        ':status': 'active'
      }
    };
    
    const result = await dynamodb.scan(collaboratorScanParams).promise();
    
    if (result.Items && result.Items.length > 0) {
      console.log(`✅ Found ${result.Items.length} collaborator role(s):`);
      result.Items.forEach((role, idx) => {
        const userId = role.PK ? role.PK.replace('USER#', '') : 'unknown';
        console.log(`   [${idx + 1}] userId: ${userId}`);
        console.log(`       channelName: ${role.channelName}`);
        console.log(`       channelId: ${role.channelId || 'N/A'}`);
        console.log(`       addedViaInvite: ${role.addedViaInvite}`);
        console.log(`       status: ${role.status || 'N/A'}`);
      });
    } else {
      console.log(`⚠️ No collaborator roles found with scan`);
    }
  } catch (error) {
    console.error(`❌ Error with scan:`, error.message);
  }

  // Check files under dehsin365@gmail.com
  console.log(`\nStep 3: Checking files under dehsin365@gmail.com...`);
  try {
    const fileQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#dehsin365@gmail.com`,
        ':skPrefix': 'FILE#'
      }
    }).promise();

    if (fileQuery.Items && fileQuery.Items.length > 0) {
      // Filter for Twilly TV
      const twillyTVFiles = fileQuery.Items.filter(f => 
        (f.folderName === channelName || f.seriesName === channelName) &&
        f.isVisible !== false &&
        f.hlsUrl
      );
      
      console.log(`✅ Found ${twillyTVFiles.length} visible files for "Twilly TV" under dehsin365@gmail.com`);
      
      // Sort by date
      const sorted = twillyTVFiles.sort((a, b) => {
        const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
        const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
        return bTime - aTime;
      });
      
      sorted.slice(0, 5).forEach((file, idx) => {
        console.log(`   [${idx + 1}] ${file.fileName || 'N/A'}`);
        console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
      });
    } else {
      console.log(`⚠️ No files found under dehsin365@gmail.com`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  console.log('\n✅ Check complete!');
}

checkCollaboratorLookup().catch(console.error);
