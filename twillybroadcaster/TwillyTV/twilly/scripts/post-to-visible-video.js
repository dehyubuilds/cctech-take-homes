const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

// User emails
const TWILLY_TV_EMAIL = 'dehyu.sinyan@gmail.com';
const DEHYUUSERNAME_EMAIL = 'dehyubuilds@gmail.com';

async function findVisibleVideo() {
  console.log('🔍 Finding a visible video from Twilly TV account...\n');
  
  const params = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    FilterExpression: '#category = :category',
    ExpressionAttributeNames: {
      '#category': 'category'
    },
    ExpressionAttributeValues: {
      ':pk': `USER#${TWILLY_TV_EMAIL}`,
      ':sk': 'FILE#',
      ':category': 'Videos'
    },
    Limit: 20,
    ScanIndexForward: false
  };
  
  const result = await dynamodb.query(params).promise();
  
  if (result.Items && result.Items.length > 0) {
    // Find one that's visible, has thumbnail, and is public (so it shows in timeline)
    const video = result.Items.find(v => 
      v.isVisible !== false && 
      v.thumbnailUrl && 
      v.isPrivateUsername !== true &&
      v.creatorUsername
    ) || result.Items.find(v => v.isVisible !== false && v.thumbnailUrl) || result.Items[0];
    
    const fileId = video.SK.replace('FILE#', '');
    
    console.log(`✅ Using video: ${video.fileName || fileId}`);
    console.log(`   File ID: ${fileId}`);
    console.log(`   Creator: ${video.creatorUsername || 'N/A'}`);
    console.log(`   isVisible: ${video.isVisible !== false}`);
    console.log(`   Has Thumbnail: ${video.thumbnailUrl ? 'YES' : 'NO'}\n`);
    
    return fileId;
  }
  
  throw new Error('No videos found');
}

async function postComment(videoId, userId, username, text, parentCommentId = null, isPrivate = false, visibleTo = []) {
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
  
  return commentId;
}

async function postConversation() {
  try {
    console.log('📝 Posting test conversation to visible video...\n');
    
    // Find visible video
    const videoId = await findVisibleVideo();
    
    // Post messages
    console.log('1️⃣ Posting public comment from dehyuusername...');
    const publicCommentId = await postComment(
      videoId,
      DEHYUUSERNAME_EMAIL,
      'dehyuusername',
      'Hello! Testing private messages.',
      null,
      false,
      []
    );
    console.log(`   ✅ Posted: ${publicCommentId}\n`);
    
    console.log('2️⃣ Posting private reply from Twilly TV...');
    const private1 = await postComment(
      videoId,
      TWILLY_TV_EMAIL,
      'Twilly TV',
      '@dehyuusername Hi! This is a private message.',
      publicCommentId,
      true,
      [TWILLY_TV_EMAIL, DEHYUUSERNAME_EMAIL]
    );
    console.log(`   ✅ Posted: ${private1}\n`);
    
    console.log('3️⃣ Posting private reply from dehyuusername...');
    const private2 = await postComment(
      videoId,
      DEHYUUSERNAME_EMAIL,
      'dehyuusername',
      '@Twilly TV Thanks! This is my response.',
      publicCommentId,
      true,
      [TWILLY_TV_EMAIL, DEHYUUSERNAME_EMAIL]
    );
    console.log(`   ✅ Posted: ${private2}\n`);
    
    console.log('4️⃣ Posting another private reply from Twilly TV...');
    const private3 = await postComment(
      videoId,
      TWILLY_TV_EMAIL,
      'Twilly TV',
      '@dehyuusername Perfect! Both sides should see all messages.',
      publicCommentId,
      true,
      [TWILLY_TV_EMAIL, DEHYUUSERNAME_EMAIL]
    );
    console.log(`   ✅ Posted: ${private3}\n`);
    
    console.log('='.repeat(60));
    console.log('✅ Conversation posted successfully!');
    console.log(`📹 Video ID: ${videoId}`);
    console.log(`📝 Messages:`);
    console.log(`   - Public: ${publicCommentId}`);
    console.log(`   - Private 1: ${private1} (Twilly TV → dehyuusername)`);
    console.log(`   - Private 2: ${private2} (dehyuusername → Twilly TV)`);
    console.log(`   - Private 3: ${private3} (Twilly TV → dehyuusername)`);
    console.log('='.repeat(60));
    console.log('\n🔍 Now check the app:');
    console.log('   1. Find this video in your timeline');
    console.log('   2. Look for red "1" badge on comment icon');
    console.log('   3. Open video and check username scroll');
    console.log('   4. Click on dehyuusername - should see all 3 private messages');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

postConversation()
  .then(() => {
    console.log('\n✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
