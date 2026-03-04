const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({ region: 'us-east-2' });
const table = 'Twilly';
const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';

async function testVideoToChannel() {
  console.log('🧪 Testing video flow: Adding existing video to Twilly After Dark channel\n');

  const channelName = 'Twilly After Dark';
  const testUsername = 'googoogaga';
  const testEmail = 'dehsin365@gmail.com'; // Email to associate with the test
  
  // Step 1: Find or create user with username "googoogaga"
  console.log(`🔍 Step 1: Setting up user "${testUsername}"...`);
  
  let userEmail = testEmail;
  let userId = null;
  
  try {
    // First, try to find user by email to get userId
    const userByEmail = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${testEmail}`,
        SK: 'PROFILE'
      }
    }).promise();
    
    if (userByEmail.Item) {
      userId = userByEmail.Item.userId || userByEmail.Item.id;
      console.log(`✅ Found user by email: ${testEmail}`);
      console.log(`   UserId: ${userId || 'N/A'}`);
      
      // Update username if needed
      if (userByEmail.Item.username !== testUsername && userByEmail.Item.userName !== testUsername) {
        console.log(`   Updating username to "${testUsername}"...`);
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `USER#${testEmail}`,
            SK: 'PROFILE'
          },
          UpdateExpression: 'SET username = :username, userName = :username, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':username': testUsername,
            ':updatedAt': new Date().toISOString()
          }
        }).promise();
        console.log(`   ✅ Username updated\n`);
      } else {
        console.log(`   Username already set to "${testUsername}"\n`);
      }
    } else {
      // Try to find by userId pattern (scan for any user with this email)
      const emailScan = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'email = :email OR userEmail = :email',
        ExpressionAttributeValues: {
          ':email': testEmail
        }
      }).promise();
      
      if (emailScan.Items && emailScan.Items.length > 0) {
        const user = emailScan.Items[0];
        userId = user.userId || user.id || user.PK?.replace('USER#', '');
        console.log(`✅ Found user via scan: ${testEmail}`);
        console.log(`   UserId: ${userId || 'N/A'}\n`);
      } else {
        // Create a test user profile
        userId = 'test-user-' + Date.now();
        console.log(`⚠️ User not found. Creating test user profile...`);
        
        const profileItem = {
          PK: `USER#${testEmail}`,
          SK: 'PROFILE',
          email: testEmail,
          userEmail: testEmail,
          userId: userId,
          id: userId,
          username: testUsername,
          userName: testUsername,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await dynamodb.put({
          TableName: table,
          Item: profileItem
        }).promise();
        
        console.log(`✅ Test user profile created with userId: ${userId}\n`);
      }
    }
  } catch (error) {
    console.error(`❌ Error setting up user: ${error.message}`);
    return;
  }

  if (!userId) {
    console.log(`❌ Could not determine userId. Exiting.`);
    return;
  }

  // Step 2: Find an existing video file in S3
  console.log(`🔍 Step 2: Finding an existing video file in S3...`);
  
  let testVideoKey = null;
  
  try {
    const s3List = await s3.listObjectsV2({
      Bucket: 'theprivatecollection',
      Prefix: 'clips/',
      MaxKeys: 100
    }).promise();
    
    if (s3List.Contents && s3List.Contents.length > 0) {
      // Find a master.m3u8 file
      const masterFile = s3List.Contents.find(obj => obj.Key.includes('_master.m3u8'));
      
      if (masterFile) {
        testVideoKey = masterFile.Key;
        console.log(`✅ Found test video:`);
        console.log(`   S3 Key: ${testVideoKey}\n`);
      }
    }
  } catch (error) {
    console.error(`❌ Error listing S3 files: ${error.message}`);
    return;
  }

  if (!testVideoKey) {
    console.log(`❌ No test video found. Exiting.`);
    return;
  }

  // Step 3: Create streamKey mapping with correct structure
  console.log(`🔍 Step 3: Creating streamKey mapping...`);
  
  const newStreamKey = `sk_test_${Date.now()}`;
  const fileName = testVideoKey.split('/').pop();
  const fileId = fileName.replace('_master.m3u8', '').split('_').pop() || `test_${Date.now()}`;
  
  try {
    const streamKeyMapping = {
      PK: `STREAM_KEY#${newStreamKey}`,
      SK: 'MAPPING',
      streamKey: newStreamKey,
      collaboratorEmail: userEmail, // CRITICAL: Use collaboratorEmail for collaborator keys
      channelName: channelName,
      seriesName: channelName,
      creatorId: userId, // Use the actual userId
      channelId: channelName,
      isActive: true,
      isPersonalKey: false,
      isCollaboratorKey: true,
      createdAt: new Date().toISOString(),
      keyNumber: 1,
      status: 'ACTIVE'
    };
    
    await dynamodb.put({
      TableName: table,
      Item: streamKeyMapping
    }).promise();
    
    console.log(`✅ StreamKey mapping created:`);
    console.log(`   StreamKey: ${newStreamKey}`);
    console.log(`   collaboratorEmail: ${userEmail}`);
    console.log(`   channelName: ${channelName}`);
    console.log(`   creatorId: ${userId}\n`);
  } catch (error) {
    console.error(`❌ Error creating streamKey mapping: ${error.message}`);
    return;
  }

  // Step 4: Create DynamoDB entry for the video
  console.log(`🔍 Step 4: Creating DynamoDB entry for video...`);
  
  const hlsUrl = `${cloudFrontBaseUrl}/${testVideoKey}`;
  const thumbnailKey = testVideoKey.replace('_master.m3u8', '_thumb.jpg');
  const thumbnailUrl = `${cloudFrontBaseUrl}/${thumbnailKey}`;
  const timestamp = new Date().toISOString();
  
  try {
    const videoItem = {
      PK: `USER#${userEmail}`,
      SK: `FILE#${fileId}`,
      fileId: fileId,
      fileName: fileName,
      fileExtension: '.m3u8',
      streamKey: newStreamKey,
      folderName: channelName,
      seriesName: channelName,
      category: 'video',
      hlsUrl: hlsUrl,
      thumbnailUrl: thumbnailUrl,
      url: hlsUrl,
      timestamp: timestamp,
      createdAt: timestamp,
      isVisible: true,
      isCollaboratorVideo: true,
      streamerEmail: userEmail
    };
    
    await dynamodb.put({
      TableName: table,
      Item: videoItem
    }).promise();
    
    console.log(`✅ Video entry created:`);
    console.log(`   PK: USER#${userEmail}`);
    console.log(`   SK: FILE#${fileId}`);
    console.log(`   Channel: ${channelName}`);
    console.log(`   HLS URL: ${hlsUrl}`);
    console.log(`   StreamKey: ${newStreamKey}\n`);
  } catch (error) {
    console.error(`❌ Error creating video entry: ${error.message}`);
    return;
  }

  // Step 5: Ensure user has collaborator role
  console.log(`🔍 Step 5: Ensuring collaborator role exists...`);
  
  try {
    const collaboratorRole = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: `COLLABORATOR_ROLE#${channelName}`
      }
    }).promise();
    
    if (!collaboratorRole.Item) {
      console.log(`   Creating collaborator role...`);
      
      const collaboratorRoleItem = {
        PK: `USER#${userId}`,
        SK: `COLLABORATOR_ROLE#${channelName}`,
        channelId: channelName,
        channelName: channelName,
        streamKey: newStreamKey,
        joinedAt: new Date().toISOString(),
        status: 'active',
        role: 'collaborator',
        addedViaInvite: true // CRITICAL: Must be true for get-content to include it
      };
      
      await dynamodb.put({
        TableName: table,
        Item: collaboratorRoleItem
      }).promise();
      
      console.log(`   ✅ Collaborator role created\n`);
    } else {
      console.log(`   ✅ Collaborator role already exists\n`);
    }
  } catch (error) {
    console.error(`❌ Error with collaborator role: ${error.message}`);
  }

  console.log(`\n✅ TEST COMPLETE!`);
  console.log(`\n📋 Summary:`);
  console.log(`   Video: ${fileName}`);
  console.log(`   Channel: ${channelName}`);
  console.log(`   Username: ${testUsername}`);
  console.log(`   Email: ${userEmail}`);
  console.log(`   UserId: ${userId}`);
  console.log(`   StreamKey: ${newStreamKey}`);
  console.log(`\n   ✅ The video should now appear in the "${channelName}" channel`);
  console.log(`   ✅ with username "${testUsername}" when you query get-content.`);
  console.log(`\n   Test in mobile app: Open "${channelName}" channel and look for the video`);
  console.log(`   with username "${testUsername}"`);
}

testVideoToChannel().catch(console.error);
