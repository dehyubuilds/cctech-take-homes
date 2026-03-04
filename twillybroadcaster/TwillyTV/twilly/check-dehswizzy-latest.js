const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkDehswizzyLatest() {
  console.log('🔍 Checking most recent files in Twilly TV for dehswizzy...\n');
  console.log('='.repeat(80));
  
  // Get all recent files in Twilly TV
  const filesResult = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': 'USER#dehyu.sinyan@gmail.com',
      ':sk': 'FILE#'
    },
    FilterExpression: 'folderName = :folderName',
    ExpressionAttributeValues: {
      ':pk': 'USER#dehyu.sinyan@gmail.com',
      ':sk': 'FILE#',
      ':folderName': 'Twilly TV'
    },
    Limit: 20,
    ScanIndexForward: false
  }).promise();
  
  if (!filesResult.Items || filesResult.Items.length === 0) {
    console.log('❌ No files found in Twilly TV');
    return;
  }
  
  console.log(`✅ Found ${filesResult.Items.length} recent file(s) in Twilly TV\n`);
  
  // Filter for dehswizzy
  const dehswizzyFiles = filesResult.Items.filter(file => {
    const creatorUsername = (file.creatorUsername || '').toLowerCase().replace('🔒', '');
    const streamerEmail = (file.streamerEmail || '').toLowerCase();
    return creatorUsername.includes('dehswizzy') || 
           streamerEmail.includes('dehswizzy') ||
           (file.creatorId && file.creatorId.includes('dehswizzy'));
  });
  
  if (dehswizzyFiles.length > 0) {
    console.log(`✅ Found ${dehswizzyFiles.length} file(s) from dehswizzy:\n`);
    dehswizzyFiles.forEach((file, idx) => {
      const time = new Date(file.timestamp || file.createdAt || 0);
      const timeAgo = Math.round((Date.now() - time.getTime()) / 1000 / 60);
      console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
      console.log(`       PK: ${file.PK}`);
      console.log(`       SK: ${file.SK}`);
      console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
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
      
      // Check why it might not be showing
      console.log(`       Visibility Analysis:`);
      if (file.isVisible === false) {
        console.log(`         ⚠️  isVisible is FALSE - stream is hidden`);
      } else {
        console.log(`         ✅ isVisible is TRUE`);
      }
      
      if (file.isPrivateUsername === true) {
        console.log(`         ⚠️  isPrivateUsername is TRUE - stream is private`);
      } else {
        console.log(`         ✅ isPrivateUsername is FALSE (public)`);
      }
      
      if (file.folderName !== 'Twilly TV') {
        console.log(`         ⚠️  folderName is "${file.folderName}" (not "Twilly TV")`);
      } else {
        console.log(`         ✅ folderName is "Twilly TV"`);
      }
      
      if (!file.creatorUsername) {
        console.log(`         ⚠️  creatorUsername is missing`);
      } else if (file.creatorUsername.includes('🔒')) {
        console.log(`         ⚠️  creatorUsername has lock: "${file.creatorUsername}"`);
      } else {
        console.log(`         ✅ creatorUsername is public: "${file.creatorUsername}"`);
      }
      console.log('');
    });
  } else {
    console.log(`❌ No files found from dehswizzy in recent Twilly TV files\n`);
    console.log(`Showing most recent 5 files instead:\n`);
    filesResult.Items.slice(0, 5).forEach((file, idx) => {
      const time = new Date(file.timestamp || file.createdAt || 0);
      const timeAgo = Math.round((Date.now() - time.getTime()) / 1000 / 60);
      console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
      console.log(`       creatorUsername: ${file.creatorUsername || 'N/A'}`);
      console.log(`       streamerEmail: ${file.streamerEmail || 'N/A'}`);
      console.log(`       isVisible: ${file.isVisible}`);
      console.log(`       isPrivateUsername: ${file.isPrivateUsername}`);
      console.log(`       Created: ${timeAgo} minutes ago`);
      console.log('');
    });
  }
  
  // Check if dehswizzy is added to viewer's timeline
  console.log(`\n📋 Checking if "dehswizzy" is added for public visibility...\n`);
  const dehswizzyProfile = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND username = :username',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':sk': 'PROFILE',
      ':username': 'dehswizzy'
    }
  }).promise();
  
  if (dehswizzyProfile.Items && dehswizzyProfile.Items.length > 0) {
    const userEmail = dehswizzyProfile.Items[0].PK.replace('USER#', '');
    console.log(`   Found dehswizzy profile: ${userEmail}\n`);
    
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
      console.log(`   ✅ Found ${addedUsernameScan.Items.length} ADDED_USERNAME entry/entries:\n`);
      addedUsernameScan.Items.forEach((entry, idx) => {
        const viewerEmail = entry.PK.replace('USER#', '');
        console.log(`   [${idx + 1}] Viewer: ${viewerEmail}`);
        console.log(`       SK: ${entry.SK}`);
        console.log(`       streamerVisibility: ${entry.streamerVisibility || 'N/A'}`);
        console.log(`       status: ${entry.status || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log(`   ⚠️  No ADDED_USERNAME entries found`);
      console.log(`   → This means "dehswizzy" is NOT added to any viewer's timeline`);
      console.log(`   → Streams won't show up in public timeline unless username is added\n`);
    }
  }
}

checkDehswizzyLatest().catch(console.error);
