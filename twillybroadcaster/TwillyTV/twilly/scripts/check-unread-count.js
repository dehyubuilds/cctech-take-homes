const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkUnreadCount() {
  const videoId = 'file-upload-1768146193473-vfjgo9s';
  const viewerEmail = 'dehyu.sinyan@gmail.com'; // Twilly TV
  
  console.log(`🔍 Checking unread count for video: ${videoId}`);
  console.log(`   Viewer: ${viewerEmail} (Twilly TV)\n`);
  
  // Normalize videoId
  const normalizedVideoId = videoId.startsWith('FILE#') ? videoId.replace('FILE#', '') : videoId;
  
  // Get all comments for this video
  const params = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `VIDEO#${normalizedVideoId}`,
      ':sk': 'COMMENT#'
    },
    ScanIndexForward: false
  };
  
  const result = await dynamodb.query(params).promise();
  const comments = result.Items || [];
  
  console.log(`📊 Found ${comments.length} comments:\n`);
  
  // Get video entry to check ownership - try both with and without FILE# prefix
  let videoEntry = null;
  let isOwner = false;
  
  const skFormats = [`FILE#${normalizedVideoId}`, normalizedVideoId];
  for (const sk of skFormats) {
    const videoScanParams = {
      TableName: table,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':sk': sk
      },
      Limit: 1
    };
    
    const videoResult = await dynamodb.scan(videoScanParams).promise();
    if (videoResult.Items && videoResult.Items.length > 0) {
      videoEntry = videoResult.Items[0];
      isOwner = videoEntry.PK && videoEntry.PK.replace('USER#', '').toLowerCase() === viewerEmail.toLowerCase();
      break;
    }
  }
  
  console.log(`📹 Video owner: ${videoEntry?.PK?.replace('USER#', '') || 'unknown'}`);
  console.log(`   Is viewer owner: ${isOwner}\n`);
  
  // Get THREAD_VIEW records
  const threadViewParams = {
    TableName: table,
    FilterExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${viewerEmail}`,
      ':sk': 'THREAD_VIEW#'
    }
  };
  
  const threadViewResult = await dynamodb.scan(threadViewParams).promise();
  const threadViews = threadViewResult.Items || [];
  
  console.log(`📋 Found ${threadViews.length} THREAD_VIEW records\n`);
  
  // Build thread last viewed map
  const threadLastViewedMap = {};
  for (const view of threadViews) {
    const threadId = view.threadId || view.SK.replace('THREAD_VIEW#', '');
    threadLastViewedMap[threadId] = view.lastViewedAt;
  }
  
  // Check each comment
  let unreadCount = 0;
  const threadUnreadCounts = {};
  
  for (const comment of comments) {
    const commentDate = new Date(comment.createdAt || comment.timestamp || 0);
    const isPrivate = comment.isPrivate === true;
    const visibleTo = comment.visibleTo || [];
    const normalizedViewerEmail = viewerEmail.toLowerCase();
    const isParticipant = visibleTo.some(email => email.toLowerCase() === normalizedViewerEmail);
    
    // Get commenter email
    let commenterEmail = null;
    if (comment.userId && comment.userId.includes('@')) {
      commenterEmail = comment.userId.toLowerCase();
    }
    const isViewerSender = commenterEmail === normalizedViewerEmail;
    
    const parentId = comment.parentCommentId || comment.commentId || comment.SK.replace('COMMENT#', '');
    const threadLastViewed = threadLastViewedMap[parentId] ? new Date(threadLastViewedMap[parentId]) : null;
    
    const shouldCount = isPrivate && (isParticipant || isOwner) && !isViewerSender;
    const isUnread = !threadLastViewed || commentDate > threadLastViewed;
    
    console.log(`💬 Comment: ${comment.commentId}`);
    console.log(`   Text: "${comment.text.substring(0, 50)}..."`);
    console.log(`   Username: ${comment.username}`);
    console.log(`   isPrivate: ${isPrivate}`);
    console.log(`   visibleTo: ${JSON.stringify(visibleTo)}`);
    console.log(`   isParticipant: ${isParticipant}`);
    console.log(`   isOwner: ${isOwner}`);
    console.log(`   isViewerSender: ${isViewerSender}`);
    console.log(`   shouldCount: ${shouldCount}`);
    console.log(`   threadLastViewed: ${threadLastViewed ? threadLastViewed.toISOString() : 'never'}`);
    console.log(`   commentDate: ${commentDate.toISOString()}`);
    console.log(`   isUnread: ${isUnread}`);
    
    if (shouldCount && isUnread) {
      unreadCount++;
      if (!threadUnreadCounts[parentId]) {
        threadUnreadCounts[parentId] = 0;
      }
      threadUnreadCounts[parentId]++;
      console.log(`   ✅ COUNTED AS UNREAD (total: ${unreadCount}, thread: ${threadUnreadCounts[parentId]})`);
    } else {
      console.log(`   ❌ NOT COUNTED`);
    }
    console.log();
  }
  
  console.log('='.repeat(60));
  console.log(`📊 FINAL RESULT:`);
  console.log(`   Total unread: ${unreadCount}`);
  console.log(`   Thread unread counts: ${JSON.stringify(threadUnreadCounts, null, 2)}`);
  console.log('='.repeat(60));
}

checkUnreadCount()
  .then(() => {
    console.log('✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
