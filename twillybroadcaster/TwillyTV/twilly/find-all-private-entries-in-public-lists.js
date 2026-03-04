const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findAllPrivateEntries() {
  console.log(`\n🔍 Scanning for all private ADDED_USERNAME entries that might appear in public lists...\n`);
  
  try {
    // Scan for all ADDED_USERNAME entries
    const scanParams = {
      TableName: table,
      FilterExpression: 'begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':skPrefix': 'ADDED_USERNAME#'
      }
    };

    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];
    
    console.log(`📋 Found ${items.length} total ADDED_USERNAME entries\n`);
    
    // Find all private entries
    const privateEntries = items.filter(item => {
      const sk = (item.SK || '').toString();
      const isPrivateBySK = sk.includes('#private');
      const visibility = (item.streamerVisibility || 'public').toLowerCase();
      const isPrivateByVisibility = visibility === 'private';
      const hasLock = (item.streamerUsername || '').includes('🔒');
      
      return isPrivateBySK || isPrivateByVisibility || hasLock;
    });
    
    if (privateEntries.length > 0) {
      console.log(`⚠️  Found ${privateEntries.length} PRIVATE entries that should be filtered:\n`);
      
      privateEntries.forEach((entry, index) => {
        console.log(`[${index + 1}] Private Entry:`);
        console.log(`   PK: ${entry.PK}`);
        console.log(`   SK: ${entry.SK}`);
        console.log(`   streamerUsername: "${entry.streamerUsername || 'MISSING'}"`);
        console.log(`   streamerVisibility: "${entry.streamerVisibility || 'public'}"`);
        console.log(`   status: "${entry.status || 'MISSING'}"`);
        
        const sk = entry.SK || '';
        if (sk.includes('#private')) {
          console.log(`   🚫 SK contains #private - this is a PRIVATE entry`);
        }
        if ((entry.streamerVisibility || 'public').toLowerCase() === 'private') {
          console.log(`   🚫 streamerVisibility is private - this is a PRIVATE entry`);
        }
        if ((entry.streamerUsername || '').includes('🔒')) {
          console.log(`   🚫 Username has lock emoji - this is a PRIVATE entry`);
        }
        console.log('');
      });
      
      console.log(`\n💡 These entries should be filtered out by the backend when fetching public added usernames.`);
      console.log(`   If they're still appearing, there may be a caching issue on the frontend.`);
    } else {
      console.log(`✅ No private entries found - all entries are public!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findAllPrivateEntries();
