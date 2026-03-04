/**
 * Cleanup script to manually delete stale ADDED_USERNAME entries
 * Run this to clean up entries that should have been deleted but weren't
 */

const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

const viewerEmail = process.argv[2] || 'dehyubuilds@gmail.com';
const ownerEmail = process.argv[3] || 'dehyu.sinyan@gmail.com';

async function cleanup() {
  console.log(`\n🧹 Cleaning up stale private entry...`);
  console.log(`Viewer: ${viewerEmail}`);
  console.log(`Owner: ${ownerEmail}\n`);

  const deleteParams = {
    TableName: table,
    Key: {
      PK: `USER#${viewerEmail.toLowerCase()}`,
      SK: `ADDED_USERNAME#${ownerEmail.toLowerCase()}#private`
    }
  };

  try {
    // Check if entry exists
    const checkResult = await dynamodb.get(deleteParams).promise();
    if (checkResult.Item) {
      console.log(`Found entry: ${checkResult.Item.SK}, status: ${checkResult.Item.status || 'N/A'}`);
      
      // Delete it
      await dynamodb.delete(deleteParams).promise();
      console.log(`✅ Deleted entry`);
      
      // Verify deletion
      const verifyResult = await dynamodb.get(deleteParams).promise();
      if (verifyResult.Item) {
        console.log(`⚠️ WARNING: Entry still exists after deletion!`);
      } else {
        console.log(`✅ Verified: Entry no longer exists`);
      }
    } else {
      console.log(`ℹ️ Entry not found - may have already been deleted`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

cleanup().catch(console.error);
