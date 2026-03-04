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

async function clearAllComments() {
  console.log('🗑️ CLEARING ALL COMMENTS FROM BOTH TABLES...\n');
  
  let totalDeleted = 0;
  
  // ============================================
  // CLEAR FROM MESSAGING TABLE (TwillyMessaging)
  // ============================================
  console.log('📊 Step 1: Clearing from TwillyMessaging table...');
  let messagingDeleted = 0;
  let lastEvaluatedKey = null;
  
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
    
    console.log(`   Found ${items.length} items in this batch`);
    
    // Delete all items
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: messagingTable,
        Key: {
          PK: item.PK,
          SK: item.SK
        }
      }).promise();
    });
    
    await Promise.all(deletePromises);
    messagingDeleted += items.length;
    console.log(`   ✅ Deleted ${items.length} items (total: ${messagingDeleted})`);
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  // Also clear THREAD_VIEW items from messaging table
  console.log('\n📊 Step 2: Clearing THREAD_VIEW items from TwillyMessaging...');
  lastEvaluatedKey = null;
  let threadViewsDeleted = 0;
  
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
    
    console.log(`   Found ${items.length} THREAD_VIEW items in this batch`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: messagingTable,
        Key: {
          PK: item.PK,
          SK: item.SK
        }
      }).promise();
    });
    
    await Promise.all(deletePromises);
    threadViewsDeleted += items.length;
    console.log(`   ✅ Deleted ${items.length} THREAD_VIEW items (total: ${threadViewsDeleted})`);
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  // ============================================
  // CLEAR FROM MAIN TABLE (Twilly) - Legacy comments
  // ============================================
  console.log('\n📊 Step 3: Clearing from Twilly table (legacy comments)...');
  lastEvaluatedKey = null;
  let mainTableDeleted = 0;
  
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
    
    console.log(`   Found ${items.length} items in this batch`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: mainTable,
        Key: {
          PK: item.PK,
          SK: item.SK
        }
      }).promise();
    });
    
    await Promise.all(deletePromises);
    mainTableDeleted += items.length;
    console.log(`   ✅ Deleted ${items.length} items (total: ${mainTableDeleted})`);
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  // Clear COMMENT# items from main table
  console.log('\n📊 Step 4: Clearing COMMENT# items from Twilly table...');
  lastEvaluatedKey = null;
  let commentItemsDeleted = 0;
  
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
    
    console.log(`   Found ${items.length} COMMENT# items in this batch`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: mainTable,
        Key: {
          PK: item.PK,
          SK: item.SK
        }
      }).promise();
    });
    
    await Promise.all(deletePromises);
    commentItemsDeleted += items.length;
    console.log(`   ✅ Deleted ${items.length} COMMENT# items (total: ${commentItemsDeleted})`);
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  // Clear THREAD_VIEW items from main table
  console.log('\n📊 Step 5: Clearing THREAD_VIEW items from Twilly table...');
  lastEvaluatedKey = null;
  let mainThreadViewsDeleted = 0;
  
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
    
    console.log(`   Found ${items.length} THREAD_VIEW items in this batch`);
    
    const deletePromises = items.map(async (item) => {
      await dynamodb.delete({
        TableName: mainTable,
        Key: {
          PK: item.PK,
          SK: item.SK
        }
      }).promise();
    });
    
    await Promise.all(deletePromises);
    mainThreadViewsDeleted += items.length;
    console.log(`   ✅ Deleted ${items.length} THREAD_VIEW items (total: ${mainThreadViewsDeleted})`);
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  totalDeleted = messagingDeleted + threadViewsDeleted + mainTableDeleted + commentItemsDeleted + mainThreadViewsDeleted;
  
  console.log('\n✅ CLEAR COMPLETE! Summary:');
  console.log(`   - TwillyMessaging: ${messagingDeleted} comments`);
  console.log(`   - TwillyMessaging: ${threadViewsDeleted} THREAD_VIEW items`);
  console.log(`   - Twilly: ${mainTableDeleted} VIDEO# items`);
  console.log(`   - Twilly: ${commentItemsDeleted} COMMENT# items`);
  console.log(`   - Twilly: ${mainThreadViewsDeleted} THREAD_VIEW items`);
  console.log(`   - TOTAL: ${totalDeleted} items deleted`);
  
  // Final verification
  console.log('\n🔍 Verifying all comments are deleted...');
  
  // Check messaging table
  const verifyMessaging = {
    TableName: messagingTable,
    FilterExpression: 'begins_with(PK, :pk)',
    ExpressionAttributeValues: {
      ':pk': 'VIDEO#'
    },
    Limit: 10
  };
  const verifyMessagingResult = await dynamodb.scan(verifyMessaging).promise();
  
  // Check main table
  const verifyMain = {
    TableName: mainTable,
    FilterExpression: 'begins_with(PK, :pk)',
    ExpressionAttributeValues: {
      ':pk': 'VIDEO#'
    },
    Limit: 10
  };
  const verifyMainResult = await dynamodb.scan(verifyMain).promise();
  
  if ((verifyMessagingResult.Items && verifyMessagingResult.Items.length > 0) ||
      (verifyMainResult.Items && verifyMainResult.Items.length > 0)) {
    console.log(`⚠️ WARNING: Still found items!`);
    if (verifyMessagingResult.Items && verifyMessagingResult.Items.length > 0) {
      console.log(`   TwillyMessaging: ${verifyMessagingResult.Items.length} items`);
    }
    if (verifyMainResult.Items && verifyMainResult.Items.length > 0) {
      console.log(`   Twilly: ${verifyMainResult.Items.length} items`);
    }
  } else {
    console.log('✅ Verification passed: No comments found in either table');
  }
}

// Run the script
clearAllComments()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
