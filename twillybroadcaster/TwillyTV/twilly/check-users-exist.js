const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkUsersExist() {
  const usernames = ['POM-J', 'dehyuusername'];
  
  for (const username of usernames) {
    console.log(`\n🔍 Checking if "${username}" exists...`);
    
    try {
      // Try GSI lookup (public)
      const gsiParams = {
        TableName: table,
        IndexName: 'UsernameSearchIndex',
        KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
        ExpressionAttributeValues: {
          ':visibility': 'public',
          ':username': username
        },
        Limit: 1
      };
      
      const gsiResult = await dynamodb.query(gsiParams).promise();
      
      if (gsiResult.Items && gsiResult.Items.length > 0) {
        const user = gsiResult.Items[0];
        const email = user.PK ? user.PK.replace('USER#', '') : null;
        console.log(`✅ Found "${username}" via GSI:`);
        console.log(`   Email: ${email}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Visibility: ${user.usernameVisibility || 'public (default)'}`);
        console.log(`   PK: ${user.PK}`);
        console.log(`   SK: ${user.SK}`);
      } else {
        console.log(`❌ "${username}" NOT FOUND via GSI`);
        console.log(`   This user does not exist or is not public`);
        console.log(`   The "Add" button would fail with "User not found" error`);
      }
    } catch (error) {
      console.log(`❌ Error checking "${username}": ${error.message}`);
      if (error.code === 'ResourceNotFoundException') {
        console.log(`   GSI not available - this would cause the API to fail`);
      }
    }
  }
}

checkUsersExist();
