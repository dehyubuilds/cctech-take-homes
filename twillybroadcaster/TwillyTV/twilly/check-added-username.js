const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkAddedUsername() {
  try {
    const requesterEmail = 'dehyu.sinyan@gmail.com';
    const requestedUserEmail = 'dehyubuilds@gmail.com';
    
    console.log(`🔍 Checking ADDED_USERNAME entry:`);
    console.log(`   PK: USER#${requesterEmail}`);
    console.log(`   SK: ADDED_USERNAME#${requestedUserEmail}`);
    
    const params = {
      TableName: table,
      Key: {
        PK: `USER#${requesterEmail}`,
        SK: `ADDED_USERNAME#${requestedUserEmail}`
      }
    };
    
    const result = await dynamodb.get(params).promise();
    
    if (result.Item) {
      console.log(`\n✅ Found ADDED_USERNAME entry:`);
      console.log(JSON.stringify(result.Item, null, 2));
      console.log(`\n📊 Key fields:`);
      console.log(`   streamerUsername: ${result.Item.streamerUsername}`);
      console.log(`   streamerVisibility: ${result.Item.streamerVisibility}`);
      console.log(`   status: ${result.Item.status}`);
      console.log(`   streamerEmail: ${result.Item.streamerEmail}`);
      
      if (result.Item.streamerVisibility?.toLowerCase() !== 'private') {
        console.log(`\n⚠️  PROBLEM: streamerVisibility is "${result.Item.streamerVisibility}" but should be "private"!`);
        console.log(`   This is why private content is not showing.`);
      } else {
        console.log(`\n✅ streamerVisibility is correctly set to "private"`);
      }
    } else {
      console.log(`\n❌ ADDED_USERNAME entry does NOT exist!`);
      console.log(`   This means the follow request was never accepted or the entry was deleted.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkAddedUsername()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
