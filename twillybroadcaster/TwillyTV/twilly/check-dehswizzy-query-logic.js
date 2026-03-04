const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkQueryLogic() {
  console.log('🔍 Checking why dehswizzy stream isn\'t showing up...\n');
  console.log('='.repeat(80));
  
  // Simulate what get-content API does
  const channelName = 'Twilly TV';
  const creatorEmail = 'dehyu.sinyan@gmail.com'; // Master account
  const viewerEmail = 'dehsin365@gmail.com'; // Assuming this is the viewer
  
  console.log(`📋 Simulating get-content API query:\n`);
  console.log(`   channelName: ${channelName}`);
  console.log(`   creatorEmail: ${creatorEmail} (master account)`);
  console.log(`   viewerEmail: ${viewerEmail}\n`);
  
  // Step 1: Query master account (what get-content does)
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
    Limit: 20,
    ScanIndexForward: false
  }).promise();
  
  console.log(`   Found ${masterQuery.Items?.length || 0} file(s) in master account\n`);
  
  // Check if dehswizzy stream is in master account
  const dehswizzyInMaster = masterQuery.Items?.filter(file => {
    const creatorUsername = (file.creatorUsername || '').toLowerCase().replace('🔒', '');
    return creatorUsername.includes('dehswizzy');
  }) || [];
  
  if (dehswizzyInMaster.length > 0) {
    console.log(`   ✅ Found ${dehswizzyInMaster.length} dehswizzy file(s) in master account\n`);
  } else {
    console.log(`   ❌ No dehswizzy files found in master account\n`);
  }
  
  // Step 2: Check what's actually stored under dehsin365@gmail.com
  console.log(`📋 STEP 2: Checking what's stored under USER#${viewerEmail}...\n`);
  const viewerQuery = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${viewerEmail}`,
      ':sk': 'FILE#'
    },
    Limit: 10,
    ScanIndexForward: false
  }).promise();
  
  console.log(`   Found ${viewerQuery.Items?.length || 0} file(s) under viewer's account\n`);
  
  const dehswizzyInViewer = viewerQuery.Items?.filter(file => {
    const creatorUsername = (file.creatorUsername || '').toLowerCase().replace('🔒', '');
    return creatorUsername.includes('dehswizzy') && file.folderName === 'Twilly TV';
  }) || [];
  
  if (dehswizzyInViewer.length > 0) {
    console.log(`   ⚠️  Found ${dehswizzyInViewer.length} dehswizzy file(s) under viewer's account (WRONG LOCATION!):\n`);
    dehswizzyInViewer.forEach((file, idx) => {
      const time = new Date(file.timestamp || file.createdAt || 0);
      const timeAgo = Math.round((Date.now() - time.getTime()) / 1000 / 60);
      console.log(`     [${idx + 1}] ${file.fileName || file.SK}`);
      console.log(`         PK: ${file.PK}`);
      console.log(`         folderName: ${file.folderName}`);
      console.log(`         isVisible: ${file.isVisible}`);
      console.log(`         isPrivateUsername: ${file.isPrivateUsername}`);
      console.log(`         creatorUsername: ${file.creatorUsername || 'N/A'}`);
      console.log(`         Created: ${timeAgo} minutes ago`);
      console.log('');
    });
    
    console.log(`   ⚠️  ROOT CAUSE IDENTIFIED:`);
    console.log(`       Streams are stored under USER#${viewerEmail}`);
    console.log(`       But get-content API queries USER#${creatorEmail} (master account)`);
    console.log(`       → Streams won't be found because they're in the wrong account!\n`);
  }
  
  // Step 3: Check if get-content would query viewer's account
  console.log(`📋 STEP 3: Checking if get-content would also query viewer's account...\n`);
  console.log(`   According to get-content logic (line 681-686):`);
  console.log(`   - It adds viewer's own email to query if channelName === 'Twilly TV'`);
  console.log(`   - So it SHOULD query both master account AND viewer's account\n`);
  
  // Simulate the combined query
  const combinedQuery = await dynamodb.query({
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
    Limit: 20,
    ScanIndexForward: false
  }).promise();
  
  console.log(`   Querying viewer's account (USER#${viewerEmail}) for Twilly TV:`);
  console.log(`   Found ${combinedQuery.Items?.length || 0} file(s)\n`);
  
  if (combinedQuery.Items && combinedQuery.Items.length > 0) {
    const dehswizzyFiles = combinedQuery.Items.filter(file => {
      const creatorUsername = (file.creatorUsername || '').toLowerCase().replace('🔒', '');
      return creatorUsername.includes('dehswizzy');
    });
    
    if (dehswizzyFiles.length > 0) {
      console.log(`   ✅ Found ${dehswizzyFiles.length} dehswizzy file(s) in viewer's account:\n`);
      dehswizzyFiles.forEach((file, idx) => {
        console.log(`     [${idx + 1}] ${file.fileName || file.SK}`);
        console.log(`         isVisible: ${file.isVisible}`);
        console.log(`         isPrivateUsername: ${file.isPrivateUsername}`);
        console.log(`         creatorUsername: ${file.creatorUsername || 'N/A'}`);
        console.log('');
      });
      
      console.log(`   → So get-content SHOULD find these files if it queries viewer's account`);
      console.log(`   → But they might be filtered out if username isn't added\n`);
    }
  }
}

checkQueryLogic().catch(console.error);
