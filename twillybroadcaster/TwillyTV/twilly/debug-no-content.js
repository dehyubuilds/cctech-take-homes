const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugNoContent() {
  console.log('🔍 Debugging "no content available" issue...\n');
  console.log('='.repeat(80));
  
  // Step 1: Check what get-content API would query
  const channelName = 'Twilly TV';
  const creatorEmail = 'dehyu.sinyan@gmail.com';
  const viewerEmail = 'dehsin365@gmail.com'; // Assuming this is the viewer
  
  console.log(`📋 Simulating get-content API:\n`);
  console.log(`   channelName: ${channelName}`);
  console.log(`   creatorEmail: ${creatorEmail}`);
  console.log(`   viewerEmail: ${viewerEmail}\n`);
  
  // Step 2: Query master account (primary query)
  console.log(`📋 STEP 1: Querying master account (USER#${creatorEmail})...\n`);
  const masterQuery = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${creatorEmail}`,
      ':sk': 'FILE#'
    },
    FilterExpression: 'folderName = :folderName',
    ExpressionAttributeValues: {
      ':pk': `USER#${creatorEmail}`,
      ':sk': 'FILE#',
      ':folderName': 'Twilly TV'
    },
    Limit: 50,
    ScanIndexForward: false
  }).promise();
  
  console.log(`   ✅ Found ${masterQuery.Items?.length || 0} file(s) in master account\n`);
  
  if (masterQuery.Items && masterQuery.Items.length > 0) {
    console.log(`   Recent files in master account:\n`);
    masterQuery.Items.slice(0, 5).forEach((file, idx) => {
      const time = new Date(file.timestamp || file.createdAt || 0);
      const timeAgo = Math.round((Date.now() - time.getTime()) / 1000 / 60);
      console.log(`     [${idx + 1}] ${file.fileName || file.SK}`);
      console.log(`         creatorUsername: ${file.creatorUsername || 'N/A'}`);
      console.log(`         isVisible: ${file.isVisible}`);
      console.log(`         isPrivateUsername: ${file.isPrivateUsername}`);
      console.log(`         Created: ${timeAgo} minutes ago`);
      console.log('');
    });
  }
  
  // Step 3: Query viewer's account (secondary query for own videos)
  console.log(`📋 STEP 2: Querying viewer's account (USER#${viewerEmail})...\n`);
  const viewerQuery = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${viewerEmail}`,
      ':sk': 'FILE#'
    },
    FilterExpression: 'folderName = :folderName',
    ExpressionAttributeValues: {
      ':pk': `USER#${viewerEmail}`,
      ':sk': 'FILE#',
      ':folderName': 'Twilly TV'
    },
    Limit: 50,
    ScanIndexForward: false
  }).promise();
  
  console.log(`   ✅ Found ${viewerQuery.Items?.length || 0} file(s) in viewer's account\n`);
  
  if (viewerQuery.Items && viewerQuery.Items.length > 0) {
    console.log(`   Files in viewer's account:\n`);
    viewerQuery.Items.forEach((file, idx) => {
      const time = new Date(file.timestamp || file.createdAt || 0);
      const timeAgo = Math.round((Date.now() - time.getTime()) / 1000 / 60);
      console.log(`     [${idx + 1}] ${file.fileName || file.SK}`);
      console.log(`         creatorUsername: ${file.creatorUsername || 'N/A'}`);
      console.log(`         streamerEmail: ${file.streamerEmail || 'N/A'}`);
      console.log(`         isVisible: ${file.isVisible}`);
      console.log(`         isPrivateUsername: ${file.isPrivateUsername}`);
      console.log(`         Created: ${timeAgo} minutes ago`);
      console.log('');
    });
  }
  
  // Step 4: Check added usernames
  console.log(`📋 STEP 3: Checking added usernames for viewer...\n`);
  const addedUsernameQuery = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${viewerEmail}`,
      ':sk': 'ADDED_USERNAME#'
    }
  }).promise();
  
  console.log(`   Found ${addedUsernameQuery.Items?.length || 0} added username(s)\n`);
  
  if (addedUsernameQuery.Items && addedUsernameQuery.Items.length > 0) {
    const publicAdded = addedUsernameQuery.Items.filter(item => {
      const visibility = item.streamerVisibility?.toLowerCase() || 'public';
      return visibility === 'public' && item.status === 'active';
    });
    const privateAdded = addedUsernameQuery.Items.filter(item => {
      const visibility = item.streamerVisibility?.toLowerCase() || 'public';
      return visibility === 'private' && item.status === 'active';
    });
    
    console.log(`   Public added usernames: ${publicAdded.length}`);
    publicAdded.forEach(item => {
      console.log(`     - ${item.streamerUsername || 'N/A'} (${item.streamerEmail || 'N/A'})`);
    });
    console.log(`\n   Private added usernames: ${privateAdded.length}`);
    privateAdded.forEach(item => {
      console.log(`     - ${item.streamerUsername || 'N/A'} (${item.streamerEmail || 'N/A'})`);
    });
  } else {
    console.log(`   ⚠️  No added usernames found`);
    console.log(`   → This means get-content will only show viewer's own videos\n`);
  }
  
  // Step 5: Check viewer's own username
  console.log(`📋 STEP 4: Checking viewer's own username...\n`);
  const viewerProfile = await dynamodb.get({
    TableName: table,
    Key: {
      PK: `USER#${viewerEmail}`,
      SK: 'PROFILE'
    }
  }).promise();
  
  if (viewerProfile.Item) {
    console.log(`   Viewer's username: ${viewerProfile.Item.username || 'N/A'}`);
    console.log(`   usernameVisibility: ${viewerProfile.Item.usernameVisibility || 'N/A'}`);
    console.log(`   isPrivateUsername: ${viewerProfile.Item.isPrivateUsername || false}\n`);
    
    // Check if viewer's own videos would match
    if (viewerQuery.Items && viewerQuery.Items.length > 0) {
      const ownVideos = viewerQuery.Items.filter(file => {
        const fileUsername = (file.creatorUsername || '').toLowerCase().replace('🔒', '');
        const viewerUsername = (viewerProfile.Item.username || '').toLowerCase();
        return fileUsername === viewerUsername || file.streamerEmail === viewerEmail;
      });
      
      console.log(`   Viewer's own videos in Twilly TV: ${ownVideos.length}\n`);
      if (ownVideos.length > 0) {
        console.log(`   ✅ Viewer should see ${ownVideos.length} own video(s)`);
        ownVideos.forEach((file, idx) => {
          console.log(`     [${idx + 1}] ${file.fileName || file.SK}`);
          console.log(`         isVisible: ${file.isVisible}`);
          console.log(`         isPrivateUsername: ${file.isPrivateUsername}`);
          console.log(`         creatorUsername: ${file.creatorUsername || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log(`   ⚠️  No own videos found - username might not match\n`);
      }
    }
  } else {
    console.log(`   ❌ No profile found for viewer\n`);
  }
  
  // Step 6: Summary
  console.log(`\n📋 SUMMARY:\n`);
  const totalFiles = (masterQuery.Items?.length || 0) + (viewerQuery.Items?.length || 0);
  console.log(`   Total files found: ${totalFiles}`);
  console.log(`   Master account: ${masterQuery.Items?.length || 0}`);
  console.log(`   Viewer account: ${viewerQuery.Items?.length || 0}`);
  console.log(`   Added usernames: ${addedUsernameQuery.Items?.length || 0}`);
  
  if (totalFiles === 0) {
    console.log(`\n   ⚠️  NO FILES FOUND - This is why "no content available" is showing\n`);
  } else {
    console.log(`\n   Files exist but might be filtered out by:`);
    console.log(`   1. isVisible = false`);
    console.log(`   2. isPrivateUsername = true (in public view)`);
    console.log(`   3. Username not added to viewer's timeline`);
    console.log(`   4. Username mismatch (creatorUsername doesn't match)`);
  }
}

debugNoContent().catch(console.error);
