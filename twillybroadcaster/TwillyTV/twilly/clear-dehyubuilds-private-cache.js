// This script is informational - the cache is on the client side
// But we can verify the database is clean

const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkDatabase() {
  const userEmail = 'dehyubuilds@gmail.com';
  const normalizedEmail = userEmail.toLowerCase();
  
  console.log(`\n🔍 Checking database for: ${normalizedEmail}\n`);
  
  try {
    // Query for all ADDED_USERNAME entries
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${normalizedEmail}`,
        ':skPrefix': 'ADDED_USERNAME#'
      }
    };

    const result = await dynamodb.query(queryParams).promise();
    const items = result.Items || [];
    
    console.log(`📋 Found ${items.length} ADDED_USERNAME entries in database:\n`);
    
    if (items.length === 0) {
      console.log('✅ Database is CLEAN - no entries found!');
      console.log('\n💡 The issue is in the frontend cache (UserDefaults).');
      console.log('   The app needs to clear the private username cache.');
      console.log('   Key to clear: addedPrivateUsernames_dehyubuilds@gmail.com');
    } else {
      items.forEach((item, index) => {
        console.log(`[${index + 1}] Entry:`);
        console.log(`   SK: ${item.SK}`);
        console.log(`   streamerUsername: "${item.streamerUsername || 'MISSING'}"`);
        console.log(`   streamerVisibility: "${item.streamerVisibility || 'public'}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDatabase();
