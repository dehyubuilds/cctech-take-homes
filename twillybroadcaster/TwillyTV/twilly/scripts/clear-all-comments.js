const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function clearAllComments() {
  console.log('🗑️ Starting to clear all comments from DynamoDB...');
  
  let totalDeleted = 0;
  let lastEvaluatedKey = null;
  
  try {
    // Scan for all comments (PK starts with VIDEO#, SK starts with COMMENT#)
    do {
      const scanParams = {
        TableName: table,
        FilterExpression: 'begins_with(PK, :pk) AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'VIDEO#',
          ':sk': 'COMMENT#'
        },
        ExclusiveStartKey: lastEvaluatedKey
      };
      
      const result = await dynamodb.scan(scanParams).promise();
      const comments = result.Items || [];
      
      console.log(`📊 Found ${comments.length} comments in this batch`);
      
      // Delete all comments in this batch
      const deletePromises = comments.map(async (comment) => {
        await dynamodb.delete({
          TableName: table,
          Key: {
            PK: comment.PK,
            SK: comment.SK
          }
        }).promise();
      });
      
      await Promise.all(deletePromises);
      totalDeleted += comments.length;
      console.log(`✅ Deleted ${comments.length} comments (total: ${totalDeleted})`);
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`\n✅ Successfully deleted ${totalDeleted} comments`);
    
    // Also clear THREAD_VIEW items
    console.log('\n🗑️ Clearing THREAD_VIEW items...');
    let threadViewsDeleted = 0;
    lastEvaluatedKey = null;
    
    do {
      const scanParams = {
        TableName: table,
        FilterExpression: 'begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':sk': 'THREAD_VIEW#'
        },
        ExclusiveStartKey: lastEvaluatedKey
      };
      
      const result = await dynamodb.scan(scanParams).promise();
      const threadViews = result.Items || [];
      
      console.log(`📊 Found ${threadViews.length} THREAD_VIEW items in this batch`);
      
      const deletePromises = threadViews.map(async (item) => {
        await dynamodb.delete({
          TableName: table,
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }).promise();
      });
      
      await Promise.all(deletePromises);
      threadViewsDeleted += threadViews.length;
      console.log(`✅ Deleted ${threadViews.length} THREAD_VIEW items (total: ${threadViewsDeleted})`);
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`\n✅ Successfully deleted ${threadViewsDeleted} THREAD_VIEW items`);
    
    // Also clear comment_reply notifications
    console.log('\n🗑️ Clearing comment_reply notifications...');
    let notificationsDeleted = 0;
    lastEvaluatedKey = null;
    
    do {
      const scanParams = {
        TableName: table,
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
      const notifications = result.Items || [];
      
      console.log(`📊 Found ${notifications.length} comment_reply notifications in this batch`);
      
      const deletePromises = notifications.map(async (notification) => {
        await dynamodb.delete({
          TableName: table,
          Key: {
            PK: notification.PK,
            SK: notification.SK
          }
        }).promise();
      });
      
      await Promise.all(deletePromises);
      notificationsDeleted += notifications.length;
      console.log(`✅ Deleted ${notifications.length} notifications (total: ${notificationsDeleted})`);
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`\n✅ Successfully deleted ${notificationsDeleted} comment_reply notifications`);
    
    console.log(`\n🎉 All done! Deleted:`);
    console.log(`   - ${totalDeleted} comments`);
    console.log(`   - ${threadViewsDeleted} THREAD_VIEW items`);
    console.log(`   - ${notificationsDeleted} comment_reply notifications`);
    console.log(`   - Total: ${totalDeleted + threadViewsDeleted + notificationsDeleted} items`);
    
  } catch (error) {
    console.error('❌ Error clearing comments:', error);
    throw error;
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
