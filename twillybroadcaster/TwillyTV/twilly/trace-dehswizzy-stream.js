const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function traceDehswizzyStream() {
  console.log('🔍 Tracing dehswizzy stream...\n');
  console.log('='.repeat(80));
  
  // Step 1: Find dehswizzy profile to get email
  console.log('\n📋 STEP 1: Finding dehswizzy profile...\n');
  const profileScan = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND (username = :username OR #username = :username)',
    ExpressionAttributeNames: {
      '#username': 'username'
    },
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':sk': 'PROFILE',
      ':username': 'dehswizzy'
    }
  }).promise();
  
  if (!profileScan.Items || profileScan.Items.length === 0) {
    console.log('❌ No profile found for username: dehswizzy');
    return;
  }
  
  const profile = profileScan.Items[0];
  const userEmail = profile.PK.replace('USER#', '');
  console.log(`✅ Found profile:`);
  console.log(`   Email: ${userEmail}`);
  console.log(`   Username: ${profile.username || 'N/A'}`);
  console.log(`   usernameVisibility: ${profile.usernameVisibility || 'N/A'}`);
  console.log(`   isPrivateUsername: ${profile.isPrivateUsername || false}`);
  
  // Step 2: Find recent streams from this user
  console.log(`\n📋 STEP 2: Finding recent streams from ${userEmail}...\n`);
  const filesResult = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userEmail}`,
      ':sk': 'FILE#'
    },
    Limit: 10,
    ScanIndexForward: false
  }).promise();
  
  if (!filesResult.Items || filesResult.Items.length === 0) {
    console.log(`❌ No files found for ${userEmail}`);
    
    // Check if files are stored under master account
    console.log(`\n📋 Checking master account (dehyu.sinyan@gmail.com)...\n`);
    const masterFiles = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FILE#'
      },
      FilterExpression: 'creatorId = :creatorId OR streamerEmail = :email',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FILE#',
        ':creatorId': profile.userId || 'N/A',
        ':email': userEmail
      },
      Limit: 10,
      ScanIndexForward: false
    }).promise();
    
    if (masterFiles.Items && masterFiles.Items.length > 0) {
      console.log(`✅ Found ${masterFiles.Items.length} file(s) under master account:\n`);
      masterFiles.Items.forEach((file, idx) => {
        const time = new Date(file.timestamp || file.createdAt || 0);
        const timeAgo = Math.round((Date.now() - time.getTime()) / 1000 / 60);
        console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
        console.log(`       folderName: ${file.folderName || 'N/A'}`);
        console.log(`       isVisible: ${file.isVisible}`);
        console.log(`       isPrivateUsername: ${file.isPrivateUsername}`);
        console.log(`       creatorUsername: ${file.creatorUsername || 'N/A'}`);
        console.log(`       creatorId: ${file.creatorId || 'N/A'}`);
        console.log(`       streamerEmail: ${file.streamerEmail || 'N/A'}`);
        console.log(`       Created: ${time.toISOString()} (${timeAgo} minutes ago)`);
        console.log(`       hlsUrl: ${file.hlsUrl ? '✅' : '❌'}`);
        console.log(`       thumbnailUrl: ${file.thumbnailUrl ? '✅' : '❌'}`);
        console.log('');
      });
    } else {
      console.log(`❌ No files found under master account either`);
    }
    return;
  }
  
  console.log(`✅ Found ${filesResult.Items.length} recent file(s):\n`);
  filesResult.Items.forEach((file, idx) => {
    const time = new Date(file.timestamp || file.createdAt || 0);
    const timeAgo = Math.round((Date.now() - time.getTime()) / 1000 / 60);
    console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
    console.log(`       folderName: ${file.folderName || 'N/A'}`);
    console.log(`       isVisible: ${file.isVisible}`);
    console.log(`       isPrivateUsername: ${file.isPrivateUsername}`);
    console.log(`       creatorUsername: ${file.creatorUsername || 'N/A'}`);
    console.log(`       creatorId: ${file.creatorId || 'N/A'}`);
    console.log(`       streamerEmail: ${file.streamerEmail || 'N/A'}`);
    console.log(`       Created: ${time.toISOString()} (${timeAgo} minutes ago)`);
    console.log(`       hlsUrl: ${file.hlsUrl ? '✅' : '❌'}`);
    console.log(`       thumbnailUrl: ${file.thumbnailUrl ? '✅' : '❌'}`);
    console.log('');
  });
  
  // Step 3: Check most recent stream in detail
  const mostRecent = filesResult.Items[0];
  console.log(`\n📋 STEP 3: Analyzing most recent stream...\n`);
  console.log(`   fileName: ${mostRecent.fileName || 'N/A'}`);
  console.log(`   PK: ${mostRecent.PK}`);
  console.log(`   SK: ${mostRecent.SK}`);
  console.log(`   streamKey: ${mostRecent.streamKey || 'N/A'}`);
  console.log(`   folderName: ${mostRecent.folderName || 'N/A'}`);
  console.log(`   isVisible: ${mostRecent.isVisible}`);
  console.log(`   isPrivateUsername: ${mostRecent.isPrivateUsername}`);
  console.log(`   creatorUsername: ${mostRecent.creatorUsername || 'N/A'}`);
  
  // Check why it might not be showing
  console.log(`\n📋 STEP 4: Checking visibility issues...\n`);
  
  if (mostRecent.isVisible === false) {
    console.log(`   ⚠️  isVisible is FALSE - stream is hidden`);
  }
  
  if (mostRecent.isPrivateUsername === true) {
    console.log(`   ⚠️  isPrivateUsername is TRUE - stream is private`);
  }
  
  if (mostRecent.folderName !== 'Twilly TV') {
    console.log(`   ⚠️  folderName is "${mostRecent.folderName}" (not "Twilly TV")`);
  }
  
  if (!mostRecent.creatorUsername || mostRecent.creatorUsername.includes('🔒')) {
    console.log(`   ⚠️  creatorUsername is "${mostRecent.creatorUsername || 'N/A'}" (has lock or missing)`);
  }
  
  // Step 5: Check streamKey mapping
  if (mostRecent.streamKey) {
    console.log(`\n📋 STEP 5: Checking streamKey mapping for: ${mostRecent.streamKey}\n`);
    const mappingResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${mostRecent.streamKey}`,
        SK: 'MAPPING'
      }
    }).promise();
    
    if (mappingResult.Item) {
      console.log('   StreamKey Mapping:');
      console.log(`     ownerEmail: ${mappingResult.Item.ownerEmail || 'N/A'}`);
      console.log(`     collaboratorEmail: ${mappingResult.Item.collaboratorEmail || 'N/A'}`);
      console.log(`     channelName: ${mappingResult.Item.channelName || mappingResult.Item.seriesName || 'N/A'}`);
      console.log(`     isPersonalKey: ${mappingResult.Item.isPersonalKey || false}`);
      console.log(`     isCollaboratorKey: ${mappingResult.Item.isCollaboratorKey || false}`);
      console.log(`     creatorId: ${mappingResult.Item.creatorId || 'N/A'}`);
      console.log(`     streamUsername: ${mappingResult.Item.streamUsername || 'N/A'}`);
      console.log(`     isPrivateUsername: ${mappingResult.Item.isPrivateUsername || false}`);
    } else {
      console.log('   ❌ No streamKey mapping found');
    }
  }
  
  // Step 6: Check if username is added to viewer's timeline
  console.log(`\n📋 STEP 6: Checking if "dehswizzy" is added for public visibility...\n`);
  const addedUsernameScan = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND streamerEmail = :email',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':skPrefix': 'ADDED_USERNAME#',
      ':email': userEmail
    }
  }).promise();
  
  if (addedUsernameScan.Items && addedUsernameScan.Items.length > 0) {
    console.log(`   Found ${addedUsernameScan.Items.length} ADDED_USERNAME entry/entries:\n`);
    addedUsernameScan.Items.forEach((entry, idx) => {
      const viewerEmail = entry.PK.replace('USER#', '');
      console.log(`   [${idx + 1}] Viewer: ${viewerEmail}`);
      console.log(`       SK: ${entry.SK}`);
      console.log(`       streamerVisibility: ${entry.streamerVisibility || 'N/A'}`);
      console.log(`       status: ${entry.status || 'N/A'}`);
      console.log(`       streamerEmail: ${entry.streamerEmail || 'N/A'}`);
      console.log('');
    });
  } else {
    console.log(`   ⚠️  No ADDED_USERNAME entries found - username might not be added to any viewer's timeline`);
  }
}

traceDehswizzyStream().catch(console.error);
