const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const mainTable = 'Twilly';
const messagingTable = 'TwillyMessaging';

async function verifyAllCommentsGone() {
  console.log('🔍 VERIFYING ALL COMMENTS ARE GONE...\n');
  
  // Check messaging table - scan EVERYTHING
  console.log('📊 Scanning ENTIRE TwillyMessaging table...');
  let lastEvaluatedKey = null;
  let allMessagingItems = [];
  
  do {
    const scanParams = {
      TableName: messagingTable,
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    if (result.Items && result.Items.length > 0) {
      allMessagingItems.push(...result.Items);
    }
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`   Total items in TwillyMessaging: ${allMessagingItems.length}`);
  
  // Filter for comment-like items
  const commentLikeItems = allMessagingItems.filter(item => {
    const pk = item.PK || '';
    const sk = item.SK || '';
    return pk.includes('VIDEO#') || 
           sk.includes('COMMENT#') || 
           sk.includes('THREAD_VIEW#') ||
           item.commentId ||
           (item.videoId && !pk.startsWith('USER#'));
  });
  
  if (commentLikeItems.length > 0) {
    console.log(`   ⚠️ FOUND ${commentLikeItems.length} COMMENT-LIKE ITEMS:\n`);
    commentLikeItems.slice(0, 10).forEach((item, idx) => {
      console.log(`   [${idx + 1}] PK: ${item.PK}, SK: ${item.SK}`);
      if (item.commentId) console.log(`       commentId: ${item.commentId}`);
      if (item.videoId) console.log(`       videoId: ${item.videoId}`);
      if (item.text) console.log(`       text: ${item.text.substring(0, 50)}...`);
    });
    if (commentLikeItems.length > 10) {
      console.log(`   ... and ${commentLikeItems.length - 10} more`);
    }
  } else {
    console.log(`   ✅ No comment-like items found`);
  }
  
  // Check main table - scan for VIDEO# items
  console.log('\n📊 Scanning Twilly table for VIDEO# items...');
  lastEvaluatedKey = null;
  let allMainItems = [];
  
  do {
    const scanParams = {
      TableName: mainTable,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'VIDEO#'
      },
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    if (result.Items && result.Items.length > 0) {
      allMainItems.push(...result.Items);
    }
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`   Total VIDEO# items in Twilly: ${allMainItems.length}`);
  
  if (allMainItems.length > 0) {
    console.log(`   ⚠️ FOUND ${allMainItems.length} VIDEO# ITEMS:\n`);
    allMainItems.slice(0, 10).forEach((item, idx) => {
      console.log(`   [${idx + 1}] PK: ${item.PK}, SK: ${item.SK}`);
      if (item.commentId) console.log(`       commentId: ${item.commentId}`);
      if (item.videoId) console.log(`       videoId: ${item.videoId}`);
      if (item.text) console.log(`       text: ${item.text.substring(0, 50)}...`);
    });
    if (allMainItems.length > 10) {
      console.log(`   ... and ${allMainItems.length - 10} more`);
    }
  } else {
    console.log(`   ✅ No VIDEO# items found`);
  }
  
  // Check for COMMENT# SK items in main table
  console.log('\n📊 Scanning Twilly table for COMMENT# SK items...');
  lastEvaluatedKey = null;
  let commentSKItems = [];
  
  do {
    const scanParams = {
      TableName: mainTable,
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':sk': 'COMMENT#'
      },
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    if (result.Items && result.Items.length > 0) {
      commentSKItems.push(...result.Items);
    }
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`   Total COMMENT# SK items in Twilly: ${commentSKItems.length}`);
  
  if (commentSKItems.length > 0) {
    console.log(`   ⚠️ FOUND ${commentSKItems.length} COMMENT# SK ITEMS:\n`);
    commentSKItems.slice(0, 10).forEach((item, idx) => {
      console.log(`   [${idx + 1}] PK: ${item.PK}, SK: ${item.SK}`);
      if (item.commentId) console.log(`       commentId: ${item.commentId}`);
      if (item.videoId) console.log(`       videoId: ${item.videoId}`);
      if (item.text) console.log(`       text: ${item.text.substring(0, 50)}...`);
    });
  } else {
    console.log(`   ✅ No COMMENT# SK items found`);
  }
  
  const totalFound = commentLikeItems.length + allMainItems.length + commentSKItems.length;
  
  console.log('\n' + '='.repeat(50));
  if (totalFound > 0) {
    console.log(`⚠️ TOTAL FOUND: ${totalFound} comment-related items`);
    console.log('\n💡 If you still see comments in the app:');
    console.log('   1. Force close and restart the app');
    console.log('   2. Clear app cache/data');
    console.log('   3. Check if comments are cached in browser (if web version)');
  } else {
    console.log(`✅ VERIFICATION PASSED: No comments found in database`);
    console.log('\n💡 If you still see comments in the app:');
    console.log('   1. Force close and restart the app (clears in-memory cache)');
    console.log('   2. The app may be showing cached data - restart will fix it');
  }
  console.log('='.repeat(50));
}

verifyAllCommentsGone()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
