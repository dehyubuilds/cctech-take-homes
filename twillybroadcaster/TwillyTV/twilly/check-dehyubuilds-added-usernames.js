const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkAddedUsernames() {
  const userEmail = 'dehyubuilds@gmail.com';
  const normalizedEmail = userEmail.toLowerCase();
  
  console.log(`\n🔍 Checking ADDED_USERNAME entries for: ${normalizedEmail}\n`);
  
  try {
    // Query for all ADDED_USERNAME entries (both public and private)
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
    
    console.log(`📋 Found ${items.length} ADDED_USERNAME entries:\n`);
    
    items.forEach((item, index) => {
      console.log(`[${index + 1}] Entry:`);
      console.log(`   SK: ${item.SK}`);
      console.log(`   streamerUsername: "${item.streamerUsername || 'MISSING'}"`);
      console.log(`   streamerEmail: "${item.streamerEmail || 'MISSING'}"`);
      console.log(`   streamerVisibility: "${item.streamerVisibility || 'public'}"`);
      console.log(`   status: "${item.status || 'MISSING'}"`);
      
      // Check if it's private
      const sk = item.SK || '';
      const isPrivateBySK = sk.includes('#private');
      const visibility = (item.streamerVisibility || 'public').toLowerCase();
      const isPrivateByVisibility = visibility === 'private';
      const hasLock = (item.streamerUsername || '').includes('🔒');
      
      console.log(`   Analysis:`);
      console.log(`     - SK contains #private: ${isPrivateBySK}`);
      console.log(`     - streamerVisibility is private: ${isPrivateByVisibility}`);
      console.log(`     - Username has lock emoji: ${hasLock}`);
      console.log(`     - Should be filtered: ${isPrivateBySK || isPrivateByVisibility || hasLock}`);
      
      if (item.streamerUsername && item.streamerUsername.toLowerCase().includes('twilly tv')) {
        console.log(`   ⚠️  THIS IS THE TWILLY TV ENTRY!`);
        if (isPrivateBySK || isPrivateByVisibility || hasLock) {
          console.log(`   🚫 This should be filtered out - it's a PRIVATE entry!`);
        }
      }
      
      console.log('');
    });
    
    // Check for Twilly TV specifically
    const twillyTVEntries = items.filter(item => {
      const username = (item.streamerUsername || '').toLowerCase();
      return username.includes('twilly tv') || username.includes('twillytv');
    });
    
    if (twillyTVEntries.length > 0) {
      console.log(`\n⚠️  Found ${twillyTVEntries.length} Twilly TV entry/entries:`);
      twillyTVEntries.forEach((entry, idx) => {
        console.log(`\n   Entry ${idx + 1}:`);
        console.log(`   SK: ${entry.SK}`);
        console.log(`   Username: "${entry.streamerUsername}"`);
        console.log(`   Visibility: "${entry.streamerVisibility || 'public'}"`);
        const sk = entry.SK || '';
        if (sk.includes('#private')) {
          console.log(`   🚫 THIS IS A PRIVATE ENTRY (SK contains #private) - should be deleted or filtered!`);
        }
        if ((entry.streamerVisibility || 'public').toLowerCase() === 'private') {
          console.log(`   🚫 THIS IS A PRIVATE ENTRY (streamerVisibility = private) - should be deleted or filtered!`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAddedUsernames();
