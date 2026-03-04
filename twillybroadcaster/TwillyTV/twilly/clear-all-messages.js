const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const messagingTable = 'TwillyMessaging';

async function clearAllMessages() {
  console.log('🗑️  Starting to clear all messages from TwillyMessaging table...');
  
  let totalDeleted = 0;
  let lastEvaluatedKey = null;
  
  do {
    const scanParams = {
      TableName: messagingTable,
      ExclusiveStartKey: lastEvaluatedKey
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    
    console.log(`📦 Found ${items.length} items to delete in this batch...`);
    
    // Delete items in batches of 25 (DynamoDB batch limit)
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      const deleteRequests = batch.map(item => ({
        DeleteRequest: {
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }
      }));
      
      const batchParams = {
        RequestItems: {
          [messagingTable]: deleteRequests
        }
      };
      
      try {
        await dynamodb.batchWrite(batchParams).promise();
        totalDeleted += batch.length;
        console.log(`✅ Deleted batch ${Math.floor(i / 25) + 1}: ${batch.length} items (total: ${totalDeleted})`);
      } catch (error) {
        console.error(`❌ Error deleting batch: ${error.message}`);
        // Retry individual items if batch fails
        for (const item of batch) {
          try {
            await dynamodb.delete({
              TableName: messagingTable,
              Key: {
                PK: item.PK,
                SK: item.SK
              }
            }).promise();
            totalDeleted++;
          } catch (err) {
            console.error(`❌ Failed to delete item ${item.PK}/${item.SK}: ${err.message}`);
          }
        }
      }
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`\n✅ Done! Deleted ${totalDeleted} total items from TwillyMessaging table.`);
}

clearAllMessages().catch(error => {
  console.error('❌ Error clearing messages:', error);
  process.exit(1);
});
