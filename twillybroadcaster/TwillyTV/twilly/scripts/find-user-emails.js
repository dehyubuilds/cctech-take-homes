const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findUserEmails() {
  console.log('🔍 Finding user emails for Twilly TV and dehyuusername...\n');
  
  const usernames = ['Twilly TV', 'dehyuusername'];
  
  for (const username of usernames) {
    try {
      const scanParams = {
        TableName: table,
        FilterExpression: 'username = :username AND SK = :sk',
        ExpressionAttributeValues: {
          ':username': username,
          ':sk': 'PROFILE'
        }
      };
      
      const result = await dynamodb.scan(scanParams).promise();
      
      if (result.Items && result.Items.length > 0) {
        const profile = result.Items[0];
        const email = profile.PK.replace('USER#', '');
        const userId = profile.userId || email;
        
        console.log(`✅ ${username}:`);
        console.log(`   Email: ${email}`);
        console.log(`   UserId: ${userId}`);
        console.log(`   PK: ${profile.PK}`);
        console.log();
      } else {
        console.log(`❌ ${username}: Not found`);
        console.log();
      }
    } catch (error) {
      console.error(`❌ Error finding ${username}:`, error.message);
    }
  }
  
  // Also check for variations
  console.log('🔍 Checking for username variations...\n');
  
  const variations = ['twilly tv', 'TwillyTV', 'dehyu', 'dehyuusername'];
  
  for (const variation of variations) {
    try {
      const scanParams = {
        TableName: table,
        FilterExpression: 'contains(username, :username) AND SK = :sk',
        ExpressionAttributeValues: {
          ':username': variation,
          ':sk': 'PROFILE'
        },
        Limit: 5
      };
      
      const result = await dynamodb.scan(scanParams).promise();
      
      if (result.Items && result.Items.length > 0) {
        console.log(`📋 Found ${result.Items.length} profiles matching "${variation}":`);
        result.Items.forEach((profile, idx) => {
          const email = profile.PK.replace('USER#', '');
          console.log(`   ${idx + 1}. ${profile.username || 'N/A'} - ${email}`);
        });
        console.log();
      }
    } catch (error) {
      // Ignore
    }
  }
}

findUserEmails()
  .then(() => {
    console.log('✅ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
