const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

// User info - actual emails from database
const TWILLY_TV_EMAIL = 'dehyu.sinyan@gmail.com';
const DEHYUUSERNAME_EMAIL = 'dehyubuilds@gmail.com';

async function findTestVideo() {
  console.log('🔍 Finding a test video...\n');
  
  // Try to find a video from either account
  const emails = [TWILLY_TV_EMAIL, DEHYUUSERNAME_EMAIL];
  
  for (const email of emails) {
    try {
      const params = {
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'category = :category',
        ExpressionAttributeValues: {
          ':pk': `USER#${email}`,
          ':sk': 'FILE#',
          ':category': 'Videos'
        },
        Limit: 5,
        ScanIndexForward: false
      };
      
      const result = await dynamodb.query(params).promise();
      
      if (result.Items && result.Items.length > 0) {
        const video = result.Items[0];
        const fileId = video.SK.replace('FILE#', '');
        
        console.log(`✅ Found video:`);
        console.log(`   Video ID: ${fileId}`);
        console.log(`   File Name: ${video.fileName || 'N/A'}`);
        console.log(`   Creator: ${video.creatorUsername || 'N/A'}`);
        console.log(`   Owner Email: ${email}\n`);
        
        return {
          videoId: fileId,
          normalizedVideoId: fileId, // Already normalized (no FILE# prefix)
          ownerEmail: email,
          video: video
        };
      }
    } catch (error) {
      console.error(`❌ Error querying ${email}:`, error.message);
    }
  }
  
  throw new Error('No videos found');
}

async function normalizeVideo(videoInfo) {
  console.log('🔧 Normalizing video structure...\n');
  
  const { video, ownerEmail } = videoInfo;
  
  // Ensure video has correct structure
  const updates = {};
  let needsUpdate = false;
  
  // Ensure videoId is normalized (no FILE# prefix in PK for comments)
  if (!video.fileId) {
    updates.fileId = videoInfo.videoId;
    needsUpdate = true;
  }
  
  if (needsUpdate) {
    console.log('📝 Updating video structure...');
    await dynamodb.update({
      TableName: table,
      Key: {
        PK: video.PK,
        SK: video.SK
      },
      UpdateExpression: 'SET ' + Object.keys(updates).map(k => `${k} = :${k}`).join(', '),
      ExpressionAttributeValues: Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [`:${k}`, v])
      )
    }).promise();
    console.log('✅ Video normalized\n');
  } else {
    console.log('✅ Video structure is correct\n');
  }
  
  return videoInfo;
}

async function postComment(videoId, userId, username, text, parentCommentId = null, isPrivate = false, visibleTo = []) {
  console.log(`📝 Posting comment as ${username}...`);
  console.log(`   Text: "${text}"`);
  console.log(`   Private: ${isPrivate}`);
  if (isPrivate) {
    console.log(`   Visible to: ${visibleTo.join(', ')}`);
  }
  
  const timestamp = Date.now();
  const commentId = `comment_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
  const sortKey = `COMMENT#${timestamp}_${commentId}`;
  
  const commentItem = {
    PK: `VIDEO#${videoId}`,
    SK: sortKey,
    commentId: commentId,
    videoId: videoId,
    userId: userId,
    username: username,
    text: text.trim(),
    createdAt: timestamp,
    timestamp: timestamp,
    likeCount: 0,
    isLiked: false,
    status: 'ACTIVE',
    isPrivate: isPrivate || null,
    parentCommentId: parentCommentId || null,
    visibleTo: visibleTo.length > 0 ? visibleTo : null
  };
  
  await dynamodb.put({
    TableName: table,
    Item: commentItem
  }).promise();
  
  console.log(`✅ Comment posted: ${commentId}\n`);
  
  return commentId;
}

async function getUserInfo(username) {
  // Try to find user by username
  const scanParams = {
    TableName: table,
    FilterExpression: 'username = :username AND SK = :sk',
    ExpressionAttributeValues: {
      ':username': username,
      ':sk': 'PROFILE'
    },
    Limit: 1
  };
  
  const result = await dynamodb.scan(scanParams).promise();
  
  if (result.Items && result.Items.length > 0) {
    const profile = result.Items[0];
    return {
      email: profile.PK.replace('USER#', ''),
      userId: profile.userId || profile.PK.replace('USER#', '')
    };
  }
  
  // Fallback - use known emails
  if (username === 'Twilly TV') {
    return {
      email: TWILLY_TV_EMAIL,
      userId: TWILLY_TV_EMAIL
    };
  } else if (username === 'dehyuusername') {
    return {
      email: DEHYUUSERNAME_EMAIL,
      userId: DEHYUUSERNAME_EMAIL
    };
  }
  
  throw new Error(`User not found: ${username}`);
}

async function testConversation() {
  try {
    console.log('🧪 Starting end-to-end conversation test\n');
    console.log('='.repeat(60));
    console.log();
    
    // Step 1: Find a test video
    const videoInfo = await findTestVideo();
    
    // Step 2: Normalize video
    const normalizedVideo = await normalizeVideo(videoInfo);
    const { videoId } = normalizedVideo;
    
    // Step 3: Get user info
    console.log('👤 Getting user information...\n');
    const twillyTVInfo = await getUserInfo('Twilly TV');
    const dehyuInfo = await getUserInfo('dehyuusername');
    
    console.log(`Twilly TV: ${twillyTVInfo.email}`);
    console.log(`dehyuusername: ${dehyuInfo.email}\n`);
    
    // Step 4: Post initial public comment from dehyuusername
    console.log('📝 Step 1: Posting initial public comment from dehyuusername...\n');
    const publicCommentId = await postComment(
      videoId,
      dehyuInfo.userId,
      'dehyuusername',
      'Hello! This is a test conversation.',
      null,
      false,
      []
    );
    
    // Step 5: Post private reply from Twilly TV to dehyuusername
    console.log('📝 Step 2: Posting private reply from Twilly TV...\n');
    const privateReply1 = await postComment(
      videoId,
      twillyTVInfo.userId,
      'Twilly TV',
      '@dehyuusername Hi! This is a private message.',
      publicCommentId,
      true,
      [twillyTVInfo.email, dehyuInfo.email]
    );
    
    // Step 6: Post private reply from dehyuusername back to Twilly TV
    console.log('📝 Step 3: Posting private reply from dehyuusername...\n');
    const privateReply2 = await postComment(
      videoId,
      dehyuInfo.userId,
      'dehyuusername',
      '@Twilly TV Thanks! This is my response.',
      publicCommentId,
      true,
      [twillyTVInfo.email, dehyuInfo.email]
    );
    
    // Step 7: Post another private reply from Twilly TV
    console.log('📝 Step 4: Posting another private reply from Twilly TV...\n');
    const privateReply3 = await postComment(
      videoId,
      twillyTVInfo.userId,
      'Twilly TV',
      '@dehyuusername Great! The conversation is working both ways.',
      publicCommentId,
      true,
      [twillyTVInfo.email, dehyuInfo.email]
    );
    
    console.log('='.repeat(60));
    console.log('✅ Test conversation posted successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Video ID: ${videoId}`);
    console.log(`   Public Comment: ${publicCommentId}`);
    console.log(`   Private Replies:`);
    console.log(`     1. ${privateReply1} (Twilly TV → dehyuusername)`);
    console.log(`     2. ${privateReply2} (dehyuusername → Twilly TV)`);
    console.log(`     3. ${privateReply3} (Twilly TV → dehyuusername)`);
    console.log();
    console.log('🔍 Now check the app to verify:');
    console.log('   1. Both users should see the full conversation');
    console.log('   2. Private thread should show all 3 messages');
    console.log('   3. Both sides should see messages from both users');
    console.log();
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the test
testConversation()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
