const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function updateProfileUsername() {
  try {
    const userEmail = 'dehyubuilds@gmail.com';
    const correctUsername = 'dehyuusername'; // The username shown in settings
    
    console.log(`🔧 Updating PROFILE username:`);
    console.log(`   PK: USER#${userEmail}`);
    console.log(`   SK: PROFILE`);
    console.log(`   Setting username to: ${correctUsername}`);
    
    // Update the PROFILE
    const updateParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      },
      UpdateExpression: 'SET username = :username, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':username': correctUsername,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamodb.update(updateParams).promise();
    
    console.log(`\n✅ Successfully updated PROFILE!`);
    console.log(`   New username: ${result.Attributes.username}`);
    console.log(`   usernameVisibility: ${result.Attributes.usernameVisibility}`);
    
    // Also update the ADDED_USERNAME entry to use the PROFILE username
    console.log(`\n🔧 Updating ADDED_USERNAME entry to use PROFILE username...`);
    const requesterEmail = 'dehyu.sinyan@gmail.com';
    
    const updateAddedParams = {
      TableName: table,
      Key: {
        PK: `USER#${requesterEmail}`,
        SK: `ADDED_USERNAME#${userEmail}`
      },
      UpdateExpression: 'SET streamerUsername = :username',
      ExpressionAttributeValues: {
        ':username': correctUsername
      },
      ReturnValues: 'ALL_NEW'
    };
    
    try {
      const addedResult = await dynamodb.update(updateAddedParams).promise();
      console.log(`✅ Updated ADDED_USERNAME entry:`);
      console.log(`   streamerUsername: ${addedResult.Attributes.streamerUsername}`);
    } catch (error) {
      if (error.code === 'ValidationException' || error.message.includes('not found')) {
        console.log(`⚠️  ADDED_USERNAME entry doesn't exist (that's okay)`);
      } else {
        throw error;
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

updateProfileUsername()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
