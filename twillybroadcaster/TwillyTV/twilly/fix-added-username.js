const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixAddedUsername() {
  try {
    const requesterEmail = 'dehyu.sinyan@gmail.com';
    const requestedUserEmail = 'dehyubuilds@gmail.com';
    const correctUsername = 'dehyuusername'; // The username that was actually requested
    
    console.log(`🔧 Fixing ADDED_USERNAME entry:`);
    console.log(`   PK: USER#${requesterEmail}`);
    console.log(`   SK: ADDED_USERNAME#${requestedUserEmail}`);
    console.log(`   Setting streamerUsername to: ${correctUsername}`);
    
    // Get current entry
    const getParams = {
      TableName: table,
      Key: {
        PK: `USER#${requesterEmail}`,
        SK: `ADDED_USERNAME#${requestedUserEmail}`
      }
    };
    
    const current = await dynamodb.get(getParams).promise();
    if (!current.Item) {
      console.log(`❌ ADDED_USERNAME entry does not exist!`);
      return;
    }
    
    console.log(`\n📊 Current entry:`);
    console.log(`   streamerUsername: ${current.Item.streamerUsername}`);
    console.log(`   streamerVisibility: ${current.Item.streamerVisibility}`);
    
    if (current.Item.streamerUsername === correctUsername) {
      console.log(`\n✅ streamerUsername is already correct!`);
      return;
    }
    
    // Update the entry
    const updateParams = {
      TableName: table,
      Key: {
        PK: `USER#${requesterEmail}`,
        SK: `ADDED_USERNAME#${requestedUserEmail}`
      },
      UpdateExpression: 'SET streamerUsername = :username',
      ExpressionAttributeValues: {
        ':username': correctUsername
      },
      ReturnValues: 'ALL_NEW'
    };
    
    const result = await dynamodb.update(updateParams).promise();
    
    console.log(`\n✅ Successfully updated ADDED_USERNAME entry!`);
    console.log(`   New streamerUsername: ${result.Attributes.streamerUsername}`);
    console.log(`   streamerVisibility: ${result.Attributes.streamerVisibility}`);
    console.log(`   status: ${result.Attributes.status}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixAddedUsername()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
