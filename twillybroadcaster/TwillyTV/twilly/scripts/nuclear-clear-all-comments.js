const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const mainTable = 'Twilly';
const messagingTable = 'TwillyMessaging';

async function nuclearClearAllComments() {
  console.log('💣 NUCLEAR: Clearing ALL comments from BOTH tables (all possible formats)...\n');
  
  let totalDeleted = 0;
  
  // ============================================
  // MESSAGING TABLE - ALL POSSIBLE PATTERNS
  // ============================================
  console.log('📊 MESSAGING TABLE: Clearing all possible comment patterns...');
  
  // Pattern 1: PK starts with VIDEO#
  let lastEvaluatedKey = null;
  let pattern1Deleted = 0;
  do {
    const scanParams = {
      TableName: messagingTable,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'VIDEO#'
      },
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    console.log(`   Pattern 1 (VIDEO# PK): Found ${items.length} items`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: messagingTable,
        Key: { PK: item.PK, SK: item.SK }
      }).promise();
    });
    await Promise.all(deletePromises);
    pattern1Deleted += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  console.log(`   ✅ Deleted ${pattern1Deleted} items`);
  
  // Pattern 2: SK starts with COMMENT#
  lastEvaluatedKey = null;
  let pattern2Deleted = 0;
  do {
    const scanParams = {
      TableName: messagingTable,
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':sk': 'COMMENT#'
      },
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    console.log(`   Pattern 2 (COMMENT# SK): Found ${items.length} items`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: messagingTable,
        Key: { PK: item.PK, SK: item.SK }
      }).promise();
    });
    await Promise.all(deletePromises);
    pattern2Deleted += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  console.log(`   ✅ Deleted ${pattern2Deleted} items`);
  
  // Pattern 3: SK starts with THREAD_VIEW#
  lastEvaluatedKey = null;
  let pattern3Deleted = 0;
  do {
    const scanParams = {
      TableName: messagingTable,
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':sk': 'THREAD_VIEW#'
      },
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    console.log(`   Pattern 3 (THREAD_VIEW# SK): Found ${items.length} items`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: messagingTable,
        Key: { PK: item.PK, SK: item.SK }
      }).promise();
    });
    await Promise.all(deletePromises);
    pattern3Deleted += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  console.log(`   ✅ Deleted ${pattern3Deleted} items`);
  
  // Pattern 4: Items with commentId field
  lastEvaluatedKey = null;
  let pattern4Deleted = 0;
  do {
    const scanParams = {
      TableName: messagingTable,
      FilterExpression: 'attribute_exists(commentId)',
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    console.log(`   Pattern 4 (has commentId): Found ${items.length} items`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: messagingTable,
        Key: { PK: item.PK, SK: item.SK }
      }).promise();
    });
    await Promise.all(deletePromises);
    pattern4Deleted += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  console.log(`   ✅ Deleted ${pattern4Deleted} items`);
  
  // Pattern 5: Items with videoId field
  lastEvaluatedKey = null;
  let pattern5Deleted = 0;
  do {
    const scanParams = {
      TableName: messagingTable,
      FilterExpression: 'attribute_exists(videoId)',
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    console.log(`   Pattern 5 (has videoId): Found ${items.length} items`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: messagingTable,
        Key: { PK: item.PK, SK: item.SK }
      }).promise();
    });
    await Promise.all(deletePromises);
    pattern5Deleted += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  console.log(`   ✅ Deleted ${pattern5Deleted} items`);
  
  const messagingTotal = pattern1Deleted + pattern2Deleted + pattern3Deleted + pattern4Deleted + pattern5Deleted;
  console.log(`\n   📊 MESSAGING TABLE TOTAL: ${messagingTotal} items deleted\n`);
  
  // ============================================
  // MAIN TABLE - ALL POSSIBLE PATTERNS
  // ============================================
  console.log('📊 MAIN TABLE: Clearing all possible comment patterns...');
  
  // Pattern 1: PK starts with VIDEO#
  lastEvaluatedKey = null;
  let mainPattern1Deleted = 0;
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
    const items = result.Items || [];
    console.log(`   Pattern 1 (VIDEO# PK): Found ${items.length} items`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: mainTable,
        Key: { PK: item.PK, SK: item.SK }
      }).promise();
    });
    await Promise.all(deletePromises);
    mainPattern1Deleted += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  console.log(`   ✅ Deleted ${mainPattern1Deleted} items`);
  
  // Pattern 2: SK starts with COMMENT#
  lastEvaluatedKey = null;
  let mainPattern2Deleted = 0;
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
    const items = result.Items || [];
    console.log(`   Pattern 2 (COMMENT# SK): Found ${items.length} items`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: mainTable,
        Key: { PK: item.PK, SK: item.SK }
      }).promise();
    });
    await Promise.all(deletePromises);
    mainPattern2Deleted += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  console.log(`   ✅ Deleted ${mainPattern2Deleted} items`);
  
  // Pattern 3: SK starts with THREAD_VIEW#
  lastEvaluatedKey = null;
  let mainPattern3Deleted = 0;
  do {
    const scanParams = {
      TableName: mainTable,
      FilterExpression: 'begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':sk': 'THREAD_VIEW#'
      },
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    console.log(`   Pattern 3 (THREAD_VIEW# SK): Found ${items.length} items`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: mainTable,
        Key: { PK: item.PK, SK: item.SK }
      }).promise();
    });
    await Promise.all(deletePromises);
    mainPattern3Deleted += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  console.log(`   ✅ Deleted ${mainPattern3Deleted} items`);
  
  // Pattern 4: Items with commentId field
  lastEvaluatedKey = null;
  let mainPattern4Deleted = 0;
  do {
    const scanParams = {
      TableName: mainTable,
      FilterExpression: 'attribute_exists(commentId)',
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    console.log(`   Pattern 4 (has commentId): Found ${items.length} items`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: mainTable,
        Key: { PK: item.PK, SK: item.SK }
      }).promise();
    });
    await Promise.all(deletePromises);
    mainPattern4Deleted += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  console.log(`   ✅ Deleted ${mainPattern4Deleted} items`);
  
  // Pattern 5: Items with videoId field (but not video entries themselves)
  lastEvaluatedKey = null;
  let mainPattern5Deleted = 0;
  do {
    const scanParams = {
      TableName: mainTable,
      FilterExpression: 'attribute_exists(videoId) AND NOT begins_with(PK, :user) AND NOT begins_with(SK, :file)',
      ExpressionAttributeValues: {
        ':user': 'USER#',
        ':file': 'FILE#'
      },
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    console.log(`   Pattern 5 (has videoId, not video entry): Found ${items.length} items`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: mainTable,
        Key: { PK: item.PK, SK: item.SK }
      }).promise();
    });
    await Promise.all(deletePromises);
    mainPattern5Deleted += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  console.log(`   ✅ Deleted ${mainPattern5Deleted} items`);
  
  // Pattern 6: Comment reply notifications
  lastEvaluatedKey = null;
  let mainPattern6Deleted = 0;
  do {
    const scanParams = {
      TableName: mainTable,
      FilterExpression: 'begins_with(PK, :pk) AND #type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':pk': 'USER#',
        ':type': 'comment_reply'
      },
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    console.log(`   Pattern 6 (comment_reply notifications): Found ${items.length} items`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: mainTable,
        Key: { PK: item.PK, SK: item.SK }
      }).promise();
    });
    await Promise.all(deletePromises);
    mainPattern6Deleted += items.length;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  console.log(`   ✅ Deleted ${mainPattern6Deleted} items`);
  
  const mainTotal = mainPattern1Deleted + mainPattern2Deleted + mainPattern3Deleted + mainPattern4Deleted + mainPattern5Deleted + mainPattern6Deleted;
  console.log(`\n   📊 MAIN TABLE TOTAL: ${mainTotal} items deleted\n`);
  
  totalDeleted = messagingTotal + mainTotal;
  
  console.log('✅ NUCLEAR CLEAR COMPLETE!');
  console.log(`   - TwillyMessaging: ${messagingTotal} items`);
  console.log(`   - Twilly: ${mainTotal} items`);
  console.log(`   - TOTAL: ${totalDeleted} items deleted\n`);
  
  // Final verification - scan entire tables for any remaining comments
  console.log('🔍 FINAL VERIFICATION: Scanning for ANY remaining comment-like items...\n');
  
  // Check messaging table - scan ALL items
  console.log('   Scanning entire TwillyMessaging table...');
  lastEvaluatedKey = null;
  let remainingMessaging = 0;
  do {
    const scanParams = {
      TableName: messagingTable,
      ExclusiveStartKey: lastEvaluatedKey
    };
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    
    // Check if any item looks like a comment
    const commentLikeItems = items.filter(item => {
      const pk = item.PK || '';
      const sk = item.SK || '';
      return pk.includes('VIDEO#') || 
             sk.includes('COMMENT#') || 
             sk.includes('THREAD_VIEW#') ||
             item.commentId ||
             (item.videoId && !pk.startsWith('USER#'));
    });
    
    if (commentLikeItems.length > 0) {
      console.log(`   ⚠️ Found ${commentLikeItems.length} comment-like items in this batch!`);
      remainingMessaging += commentLikeItems.length;
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  // Check main table - scan for VIDEO# items
  console.log('   Scanning Twilly table for VIDEO# items...');
  const verifyMain = {
    TableName: mainTable,
    FilterExpression: 'begins_with(PK, :pk)',
    ExpressionAttributeValues: {
      ':pk': 'VIDEO#'
    },
    Limit: 100
  };
  const verifyMainResult = await dynamodb.scan(verifyMain).promise();
  const remainingMain = verifyMainResult.Items?.length || 0;
  
  if (remainingMessaging > 0 || remainingMain > 0) {
    console.log(`\n⚠️ WARNING: Still found items!`);
    if (remainingMessaging > 0) {
      console.log(`   TwillyMessaging: ${remainingMessaging} comment-like items`);
    }
    if (remainingMain > 0) {
      console.log(`   Twilly: ${remainingMain} VIDEO# items`);
    }
  } else {
    console.log('✅ Verification passed: No comments found in either table');
  }
}

// Run the script
nuclearClearAllComments()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
