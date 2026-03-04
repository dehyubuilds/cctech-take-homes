const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugDehswizzyStream() {
  console.log('🔍 Debugging dehswizzy stream...\n');

  // Step 1: Find dehswizzy's userId and email
  console.log('Step 1: Finding dehswizzy user record...');
  try {
    const userScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'username = :username OR email = :email',
      ExpressionAttributeValues: {
        ':username': 'dehswizzy',
        ':email': 'dehsin365@gmail.com'
      }
    }).promise();

    if (userScan.Items && userScan.Items.length > 0) {
      console.log(`✅ Found ${userScan.Items.length} user record(s):`);
      userScan.Items.forEach((user, idx) => {
        console.log(`   [${idx}] PK: ${user.PK}, SK: ${user.SK}`);
        console.log(`       userId: ${user.userId || 'N/A'}, email: ${user.email || user.userEmail || 'N/A'}, username: ${user.username || 'N/A'}`);
      });
    } else {
      console.log('❌ No user record found for dehswizzy');
    }
  } catch (error) {
    console.error('❌ Error finding user:', error.message);
  }

  // Step 2: Find COLLABORATOR_ROLE records for dehswizzy
  console.log('\nStep 2: Finding COLLABORATOR_ROLE records...');
  try {
    const collaboratorScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'COLLABORATOR_ROLE#'
      }
    }).promise();

    if (collaboratorScan.Items) {
      // Filter for records that might be dehswizzy's
      const relevantRoles = collaboratorScan.Items.filter(role => {
        const userId = role.PK ? role.PK.replace('USER#', '') : null;
        // Check if this might be dehswizzy (we'll check by looking at all and filtering)
        return true; // Show all for now
      });

      console.log(`✅ Found ${relevantRoles.length} COLLABORATOR_ROLE records (showing all):`);
      relevantRoles.forEach((role, idx) => {
        console.log(`   [${idx}] PK: ${role.PK}, SK: ${role.SK}`);
        console.log(`       channelName: ${role.channelName || 'N/A'}, channelId: ${role.channelId || 'N/A'}`);
        console.log(`       addedViaInvite: ${role.addedViaInvite}, status: ${role.status || 'N/A'}`);
        console.log(`       streamKey: ${role.streamKey || 'N/A'}`);
      });
    }
  } catch (error) {
    console.error('❌ Error finding COLLABORATOR_ROLE records:', error.message);
  }

  // Step 3: Find STREAM_KEY mappings for dehswizzy
  console.log('\nStep 3: Finding STREAM_KEY mappings...');
  try {
    const streamKeyScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
      ExpressionAttributeValues: {
        ':pkPrefix': 'STREAM_KEY#',
        ':sk': 'MAPPING'
      }
    }).promise();

    if (streamKeyScan.Items) {
      // Filter for collaborator keys
      const collaboratorKeys = streamKeyScan.Items.filter(sk => 
        sk.isCollaboratorKey === true && 
        (sk.collaboratorEmail === 'dehsin365@gmail.com' || sk.creatorId)
      );

      console.log(`✅ Found ${collaboratorKeys.length} collaborator stream keys:`);
      collaboratorKeys.forEach((sk, idx) => {
        console.log(`   [${idx}] streamKey: ${sk.streamKey}`);
        console.log(`       collaboratorEmail: ${sk.collaboratorEmail || 'N/A'}`);
        console.log(`       creatorId: ${sk.creatorId || 'N/A'}`);
        console.log(`       channelName: ${sk.channelName || 'N/A'}`);
        console.log(`       isCollaboratorKey: ${sk.isCollaboratorKey}`);
      });
    }
  } catch (error) {
    console.error('❌ Error finding STREAM_KEY mappings:', error.message);
  }

  // Step 4: Find files for dehswizzy
  console.log('\nStep 4: Finding files for dehswizzy...');
  const possibleEmails = ['dehsin365@gmail.com'];
  
  // Also try to find userId from previous steps
  for (const email of possibleEmails) {
    try {
      const fileQuery = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${email}`,
          ':skPrefix': 'FILE#'
        },
        Limit: 20
      }).promise();

      if (fileQuery.Items && fileQuery.Items.length > 0) {
        console.log(`✅ Found ${fileQuery.Items.length} files for ${email}:`);
        fileQuery.Items.forEach((file, idx) => {
          console.log(`   [${idx}] fileName: ${file.fileName || 'N/A'}`);
          console.log(`       folderName: ${file.folderName || 'N/A'}, seriesName: ${file.seriesName || 'N/A'}`);
          console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
          console.log(`       isVisible: ${file.isVisible}, hasHls: ${!!file.hlsUrl}`);
          console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
        });
      } else {
        console.log(`⚠️ No files found for ${email}`);
      }
    } catch (error) {
      console.error(`❌ Error querying files for ${email}:`, error.message);
    }
  }

  // Step 5: Check recent files across all users (last 50 files)
  console.log('\nStep 5: Checking recent files across all users...');
  try {
    const allFilesScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#'
      },
      Limit: 50
    }).promise();

    if (allFilesScan.Items) {
      // Sort by createdAt/timestamp (newest first)
      const sortedFiles = allFilesScan.Items.sort((a, b) => {
        const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
        const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
        return bTime - aTime;
      });

      console.log(`✅ Found ${sortedFiles.length} recent files (showing first 10):`);
      sortedFiles.slice(0, 10).forEach((file, idx) => {
        const owner = file.PK ? file.PK.replace('USER#', '') : 'unknown';
        console.log(`   [${idx}] Owner: ${owner}`);
        console.log(`       fileName: ${file.fileName || 'N/A'}`);
        console.log(`       folderName: ${file.folderName || 'N/A'}, seriesName: ${file.seriesName || 'N/A'}`);
        console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`       createdAt: ${file.createdAt || file.timestamp || 'N/A'}`);
      });
    }
  } catch (error) {
    console.error('❌ Error scanning all files:', error.message);
  }

  console.log('\n✅ Debug complete!');
}

// Run the debug
debugDehswizzyStream().catch(console.error);
