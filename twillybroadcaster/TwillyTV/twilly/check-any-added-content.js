const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkAnyAddedContent() {
  console.log('🔍 Checking if ANY users were added and have content...\n');
  
  const twillyTVEmail = 'dehyu.sinyan@gmail.com';
  
  // Get all ADDED_USERNAME entries
  const addedParams = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    FilterExpression: '#status = :status',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':pk': `USER#${twillyTVEmail.toLowerCase()}`,
      ':skPrefix': 'ADDED_USERNAME#',
      ':status': 'active'
    }
  };
  const addedResult = await dynamodb.query(addedParams).promise();
  
  console.log(`Found ${addedResult.Items?.length || 0} ADDED_USERNAME entries\n`);
  
  if (!addedResult.Items || addedResult.Items.length === 0) {
    console.log('❌ NO ADDED_USERNAME entries - the "Add" button is not working!');
    console.log('   The backend fix needs to be deployed to Netlify first.');
    return;
  }
  
  // Get all Twilly TV content
  const contentParams = {
    TableName: table,
    FilterExpression: 'channelName = :channelName',
    ExpressionAttributeValues: {
      ':channelName': 'Twilly TV'
    }
  };
  
  let allContent = [];
  let lastEvaluatedKey = null;
  do {
    if (lastEvaluatedKey) {
      contentParams.ExclusiveStartKey = lastEvaluatedKey;
    }
    const contentResult = await dynamodb.scan(contentParams).promise();
    if (contentResult.Items) {
      allContent = allContent.concat(contentResult.Items);
    }
    lastEvaluatedKey = contentResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`Found ${allContent.length} total content items in Twilly TV\n`);
  
  // Build added usernames sets
  const addedUsernamesPublic = new Set();
  const addedEmails = new Set();
  
  for (const item of addedResult.Items) {
    if (item.streamerUsername) {
      const usernameLower = item.streamerUsername.toLowerCase();
      const visibility = item.streamerVisibility || 'public';
      if (visibility.toLowerCase() === 'public') {
        addedUsernamesPublic.add(usernameLower);
        console.log(`✅ Added (PUBLIC): "${item.streamerUsername}" (email: ${item.streamerEmail})`);
      }
    }
    if (item.streamerEmail) {
      addedEmails.add(item.streamerEmail.toLowerCase());
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Added usernames (PUBLIC): [${Array.from(addedUsernamesPublic).join(', ')}]`);
  console.log(`   Added emails: [${Array.from(addedEmails).join(', ')}]`);
  
  // Check which content should show
  console.log(`\n📹 Checking content from added users...\n`);
  
  let matchingContent = [];
  for (const item of allContent) {
    const itemUsername = (item.creatorUsername || '').toLowerCase().trim().replace('🔒', '');
    const itemEmail = (item.streamerEmail || '').toLowerCase();
    const isPrivate = (item.creatorUsername && item.creatorUsername.includes('🔒')) || (item.isPrivateUsername === true);
    
    // Skip private content (we're checking public timeline)
    if (isPrivate) continue;
    
    // Check if username matches
    const usernameMatch = itemUsername && addedUsernamesPublic.has(itemUsername);
    // Check if email matches
    const emailMatch = itemEmail && addedEmails.has(itemEmail);
    
    if (usernameMatch || emailMatch) {
      matchingContent.push({
        item,
        matchType: usernameMatch ? 'username' : 'email',
        username: itemUsername,
        email: itemEmail
      });
    }
  }
  
  console.log(`Found ${matchingContent.length} content items from added users:\n`);
  
  if (matchingContent.length > 0) {
    for (const match of matchingContent.slice(0, 10)) {
      console.log(`✅ ${match.item.SK}`);
      console.log(`   Match by: ${match.matchType}`);
      console.log(`   creatorUsername: "${match.item.creatorUsername || 'NOT SET'}"`);
      console.log(`   streamerEmail: "${match.item.streamerEmail || 'NOT SET'}"`);
      console.log('');
    }
  } else {
    console.log('❌ NO MATCHING CONTENT FOUND!');
    console.log('   This means either:');
    console.log('   1. The added users have not posted content yet');
    console.log('   2. The username/email matching is failing');
    console.log('   3. The content is marked as private');
  }
}

checkAnyAddedContent().catch(console.error);
