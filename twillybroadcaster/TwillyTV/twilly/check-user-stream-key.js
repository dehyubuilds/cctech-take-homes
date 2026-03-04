import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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',
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function findUserByUsername(username) {
  console.log(`🔍 Searching for user with username: ${username}`);
  
  // Try scanning for user by username
  const scanParams = {
    TableName: table,
    FilterExpression: 'SK = :sk AND username = :username',
    ExpressionAttributeValues: {
      ':sk': 'PROFILE',
      ':username': username
    }
  };
  
  const result = await dynamodb.scan(scanParams).promise();
  const users = result.Items || [];
  
  // Find case-insensitive match
  const trimmedUsername = username.trim().toLowerCase();
  const user = users.find(item => 
    item.username && item.username.trim().toLowerCase() === trimmedUsername
  );
  
  if (user) {
    const email = user.email || user.userEmail || user.PK?.replace('USER#', '');
    const userId = user.userId || user.PK?.replace('USER#', '');
    console.log(`✅ Found user:`);
    console.log(`   Email: ${email}`);
    console.log(`   UserId: ${userId}`);
    console.log(`   Username: ${user.username}`);
    return { email, userId, username: user.username };
  }
  
  // Fallback: Try GSI if available
  try {
    for (const visibility of ['public', 'private']) {
      const queryParams = {
        TableName: table,
        IndexName: 'UsernameSearchIndex',
        KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
        ExpressionAttributeValues: {
          ':visibility': visibility,
          ':username': username
        },
        Limit: 1
      };
      
      const result = await dynamodb.query(queryParams).promise();
      if (result.Items && result.Items.length > 0) {
        const foundUser = result.Items.find(item => 
          item.username && item.username.toLowerCase() === username.toLowerCase()
        );
        if (foundUser) {
          const email = foundUser.email || foundUser.userEmail || foundUser.PK?.replace('USER#', '');
          const userId = foundUser.userId || foundUser.PK?.replace('USER#', '');
          console.log(`✅ Found user via GSI:`);
          console.log(`   Email: ${email}`);
          console.log(`   UserId: ${userId}`);
          console.log(`   Username: ${foundUser.username}`);
          return { email, userId, username: foundUser.username };
        }
      }
    }
  } catch (error) {
    console.log(`⚠️ GSI lookup failed (may not exist): ${error.message}`);
  }
  
  return null;
}

async function checkUserStreamKeys(userId, userEmail) {
  console.log(`\n🔍 Checking for existing stream keys for user...`);
  
  const allKeys = [];
  
  // Check 1: Collaborator keys (PK=CHANNEL#channelId, SK=COLLABORATOR#userId)
  console.log(`   Checking CHANNEL#* COLLABORATOR#${userId}...`);
  const scanParams = {
    TableName: table,
    FilterExpression: 'begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':skPrefix': `COLLABORATOR#${userId}`
    }
  };
  
  const result = await dynamodb.scan(scanParams).promise();
  const collaboratorKeys = result.Items || [];
  
  if (collaboratorKeys.length > 0) {
    console.log(`   ✅ Found ${collaboratorKeys.length} collaborator key(s) in CHANNEL records`);
    allKeys.push(...collaboratorKeys);
  }
  
  // Check 2: User collaboration role records (PK=USER#userId, SK=COLLABORATOR_ROLE#channelId)
  console.log(`   Checking USER#${userId} COLLABORATOR_ROLE#*...`);
  const userRoleParams = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':skPrefix': 'COLLABORATOR_ROLE#'
    }
  };
  
  try {
    const userRoleResult = await dynamodb.query(userRoleParams).promise();
    const userRoleKeys = userRoleResult.Items || [];
    
    if (userRoleKeys.length > 0) {
      console.log(`   ✅ Found ${userRoleKeys.length} collaborator role record(s) in USER records`);
      allKeys.push(...userRoleKeys);
    }
  } catch (error) {
    console.log(`   ⚠️ Error querying user role records: ${error.message}`);
  }
  
  // Check 3: Stream key mappings (PK=STREAM_KEY#*, check by collaboratorEmail or ownerEmail)
  console.log(`   Checking STREAM_KEY#* mappings for ${userEmail}...`);
  const streamKeyScanParams = {
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND (collaboratorEmail = :email OR ownerEmail = :email)',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':email': userEmail
    }
  };
  
  try {
    const streamKeyResult = await dynamodb.scan(streamKeyScanParams).promise();
    const streamKeyMappings = streamKeyResult.Items || [];
    
    if (streamKeyMappings.length > 0) {
      console.log(`   ✅ Found ${streamKeyMappings.length} stream key mapping(s)`);
      allKeys.push(...streamKeyMappings);
    }
  } catch (error) {
    console.log(`   ⚠️ Error scanning stream key mappings: ${error.message}`);
  }
  
  // Deduplicate and display
  const uniqueKeys = new Map();
  allKeys.forEach(item => {
    const streamKey = item.streamKey;
    if (streamKey && !uniqueKeys.has(streamKey)) {
      uniqueKeys.set(streamKey, item);
    }
  });
  
  if (uniqueKeys.size > 0) {
    console.log(`\n✅ Found ${uniqueKeys.size} unique stream key(s) for this user:`);
    Array.from(uniqueKeys.values()).forEach((item, index) => {
      const channelId = item.PK?.replace('CHANNEL#', '') || item.channelId || 'N/A';
      const channelName = item.channelName || item.seriesName || 'N/A';
      console.log(`\n   Stream Key ${index + 1}:`);
      console.log(`     Stream Key: ${item.streamKey}`);
      console.log(`     Channel ID: ${channelId}`);
      console.log(`     Channel Name: ${channelName}`);
      console.log(`     Location: ${item.PK} / ${item.SK}`);
      console.log(`     Created: ${item.createdAt || item.joinedAt || 'N/A'}`);
    });
    return Array.from(uniqueKeys.values());
  } else {
    console.log(`\n❌ No existing stream keys found for this user.`);
    console.log(`   Note: Stream keys are created automatically when a user first tries to stream.`);
    return [];
  }
}

async function createStreamKeyForUser(userId, userEmail, username) {
  console.log(`\n🔧 Creating stream key for user...`);
  
  // Use Twilly TV channel as default
  const channelId = 'twilly-tv-channel-id';
  const channelName = 'Twilly TV';
  
  // Generate stream key
  const streamKey = `sk_${generateRandomString(16)}`;
  
  // Check if channel exists
  const channelCheck = await dynamodb.get({
    TableName: table,
    Key: {
      PK: `CHANNEL#${channelId}`,
      SK: 'METADATA'
    }
  }).promise();
  
  if (!channelCheck.Item) {
    console.log(`⚠️ Channel ${channelId} not found. Creating channel metadata...`);
    await dynamodb.put({
      TableName: table,
      Item: {
        PK: `CHANNEL#${channelId}`,
        SK: 'METADATA',
        channelName: channelName,
        visibility: 'public',
        createdAt: new Date().toISOString()
      }
    }).promise();
  }
  
  // Create collaborator key
  const collaboratorKey = {
    PK: `CHANNEL#${channelId}`,
    SK: `COLLABORATOR#${userId}`,
    streamKey: streamKey,
    collaboratorEmail: userEmail,
    collaboratorId: userId,
    collaboratorUsername: username,
    channelName: channelName,
    channelId: channelId,
    isCollaboratorKey: true,
    createdAt: new Date().toISOString()
  };
  
  await dynamodb.put({
    TableName: table,
    Item: collaboratorKey
  }).promise();
  
  // Create stream key mapping
  const streamKeyMapping = {
    PK: `STREAM_KEY#${streamKey}`,
    SK: 'MAPPING',
    streamKey: streamKey,
    collaboratorEmail: userEmail,
    collaboratorId: userId,
    collaboratorUsername: username,
    channelName: channelName,
    channelId: channelId,
    isCollaboratorKey: true,
    createdAt: new Date().toISOString()
  };
  
  await dynamodb.put({
    TableName: table,
    Item: streamKeyMapping
  }).promise();
  
  console.log(`✅ Created stream key successfully!`);
  console.log(`   Stream Key: ${streamKey}`);
  console.log(`   Channel: ${channelName}`);
  console.log(`   RTMP URL: rtmp://100.24.103.57:1935/live/${streamKey}`);
  
  return streamKey;
}

async function main() {
  const username = process.argv[2] || 'kalyxthealien';
  
  console.log(`\n🚀 Checking RTMP stream key for user: ${username}\n`);
  
  // Step 1: Find user
  const user = await findUserByUsername(username);
  
  if (!user) {
    console.log(`\n❌ User "${username}" not found in database.`);
    process.exit(1);
  }
  
  // Step 2: Check for existing stream keys
  const existingKeys = await checkUserStreamKeys(user.userId, user.email);
  
  // Step 3: Report findings (don't create - keys are created on-demand when streaming)
  if (existingKeys.length === 0) {
    console.log(`\n📝 No stream keys found.`);
    console.log(`   Stream keys are created automatically when a user first tries to stream from the app.`);
    console.log(`   The user can trigger key creation by attempting to stream to Twilly TV.`);
  } else {
    console.log(`\n✅ User already has ${existingKeys.length} stream key(s).`);
  }
  
  console.log(`\n✨ Done!\n`);
}

main().catch(error => {
  console.error(`\n❌ Error:`, error);
  process.exit(1);
});
