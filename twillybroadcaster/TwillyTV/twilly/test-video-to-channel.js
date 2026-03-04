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
  
  // Step 1: Find a user with username "googoogaga" or create test data
  console.log(`🔍 Step 1: Looking up user "${testUsername}"...`);
  
  let userEmail = null;
  let userId = null;
  
  try {
    // Try to find user by username
    const userScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'username = :username OR userName = :username',
      ExpressionAttributeValues: {
        ':username': testUsername
      }
    }).promise();
    
    if (userScan.Items && userScan.Items.length > 0) {
      const user = userScan.Items[0];
      userEmail = user.email || user.userEmail || user.PK?.replace('USER#', '');
      userId = user.userId || user.id || user.PK?.replace('USER#', '');
      console.log(`✅ Found user: ${testUsername}`);
      console.log(`   Email: ${userEmail}`);
      console.log(`   UserId: ${userId}\n`);
    } else {
      console.log(`⚠️ User "${testUsername}" not found. Will use test email.\n`);
      // Use a test email - you can change this
      userEmail = 'dehsin365@gmail.com'; // Change this to the email you want to test with
      userId = 'test-user-id-' + Date.now();
    }
  } catch (error) {
    console.error(`❌ Error looking up user: ${error.message}`);
    return;
  }

  // Step 2: Find an existing video file in S3
  console.log(`🔍 Step 2: Finding an existing video file in S3...`);
  
  let testVideoKey = null;
  let testStreamKey = null;
  
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
        // Extract streamKey from path: clips/{streamKey}/...
        const pathParts = testVideoKey.split('/');
        if (pathParts.length >= 2) {
          testStreamKey = pathParts[1];
        }
        console.log(`✅ Found test video:`);
        console.log(`   S3 Key: ${testVideoKey}`);
        console.log(`   StreamKey: ${testStreamKey || 'N/A'}\n`);
      } else {
        console.log(`⚠️ No master.m3u8 files found. Using manual path.\n`);
        // Use a known video path
        testVideoKey = 'clips/sk_0cmokm4vjmfh4nod/sk_0cmokm4vjmfh4nod_2026-01-30T18-57-43-126Z_ynybsxn2_master.m3u8';
        testStreamKey = 'sk_0cmokm4vjmfh4nod';
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

  // Step 3: Create or update streamKey mapping with correct structure
  console.log(`🔍 Step 3: Creating/updating streamKey mapping...`);
  
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
      creatorId: userId,
      channelId: channelName, // Use channelName as channelId for simplicity
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
      streamKey: newStreamKey, // Use the new streamKey we created
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

  // Step 5: Verify the video will appear in get-content
  console.log(`🔍 Step 5: Verifying video will appear in channel...`);
  
  try {
    // Check if user has collaborator role for this channel
    const collaboratorRole = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: `COLLABORATOR_ROLE#${channelName}`
      }
    }).promise();
    
    if (!collaboratorRole.Item) {
      console.log(`⚠️ User doesn't have collaborator role. Creating it...`);
      
      const collaboratorRoleItem = {
        PK: `USER#${userId}`,
        SK: `COLLABORATOR_ROLE#${channelName}`,
        channelId: channelName,
        channelName: channelName,
        streamKey: newStreamKey,
        joinedAt: new Date().toISOString(),
        status: 'active',
        role: 'collaborator',
        addedViaInvite: true // Mark as invite-based for get-content filtering
      };
      
      await dynamodb.put({
        TableName: table,
        Item: collaboratorRoleItem
      }).promise();
      
      console.log(`✅ Collaborator role created\n`);
    } else {
      console.log(`✅ User already has collaborator role\n`);
    }
  } catch (error) {
    console.error(`❌ Error checking collaborator role: ${error.message}`);
  }

  // Step 6: Verify username lookup
  console.log(`🔍 Step 6: Verifying username lookup...`);
  
  try {
    // Make sure user profile has username
    const userProfile = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE'
      }
    }).promise();
    
    if (!userProfile.Item || !userProfile.Item.username) {
      console.log(`⚠️ User profile missing or no username. Creating/updating...`);
      
      const profileItem = {
        PK: `USER#${userId}`,
        SK: 'PROFILE',
        email: userEmail,
        userEmail: userEmail,
        username: testUsername,
        userName: testUsername,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await dynamodb.put({
        TableName: table,
        Item: profileItem
      }).promise();
      
      console.log(`✅ User profile created/updated with username: ${testUsername}\n`);
    } else {
      console.log(`✅ User profile exists with username: ${userProfile.Item.username || userProfile.Item.userName}\n`);
    }
  } catch (error) {
    console.error(`❌ Error checking user profile: ${error.message}`);
  }

  console.log(`\n✅ TEST COMPLETE!`);
  console.log(`\n📋 Summary:`);
  console.log(`   Video: ${fileName}`);
  console.log(`   Channel: ${channelName}`);
  console.log(`   Username: ${testUsername}`);
  console.log(`   Email: ${userEmail}`);
  console.log(`   StreamKey: ${newStreamKey}`);
  console.log(`\n   The video should now appear in the "${channelName}" channel`);
  console.log(`   with username "${testUsername}" when you query get-content.`);
  console.log(`\n   Test by calling: POST /api/channels/get-content`);
  console.log(`   with body: { "channelName": "${channelName}" }`);
}

testVideoToChannel().catch(console.error);
