const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkTwillyTVRequest() {
  try {
    const targetUsername = 'Twilly TV';
    
    console.log(`🔍 Checking follow requests for username: "${targetUsername}"`);
    
    // First, find the email for "Twilly TV" username
    console.log(`\n1️⃣ Finding email for username "${targetUsername}"...`);
    
    let twillyTVEmail = null;
    
    // Try to find via GSI
    try {
      for (const visibility of ['public', 'private']) {
        const queryParams = {
          TableName: table,
          IndexName: 'UsernameSearchIndex',
          KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
          ExpressionAttributeValues: {
            ':visibility': visibility,
            ':username': targetUsername
          },
          Limit: 1
        };
        
        const result = await dynamodb.query(queryParams).promise();
        if (result.Items && result.Items.length > 0) {
          const item = result.Items[0];
          twillyTVEmail = item.email || item.PK?.replace('USER#', '');
          if (twillyTVEmail) {
            twillyTVEmail = twillyTVEmail.toLowerCase();
            console.log(`✅ Found email via GSI: ${twillyTVEmail}`);
            break;
          }
        }
      }
    } catch (error) {
      console.log(`⚠️  GSI query failed: ${error.message}`);
    }
    
    if (!twillyTVEmail) {
      console.log(`❌ Could not find email for username "${targetUsername}"`);
      return;
    }
    
    console.log(`\n2️⃣ Querying follow requests for: ${twillyTVEmail}`);
    console.log(`   PK: USER#${twillyTVEmail}`);
    console.log(`   SK prefix: FOLLOW_REQUEST#`);
    
    // Query for all follow requests (not just pending)
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${twillyTVEmail}`,
        ':skPrefix': 'FOLLOW_REQUEST#'
      }
    };
    
    const result = await dynamodb.query(queryParams).promise();
    const allRequests = result.Items || [];
    
    console.log(`\n📊 Total follow requests found: ${allRequests.length}`);
    
    if (allRequests.length === 0) {
      console.log(`\n⚠️  No follow requests found for "${targetUsername}" (${twillyTVEmail})`);
      console.log(`   This means either:`);
      console.log(`   1. No requests have been made yet`);
      console.log(`   2. Requests were deleted`);
      console.log(`   3. Requests are stored under a different email`);
    } else {
      console.log(`\n📋 All Follow Requests:`);
      allRequests.forEach((request, index) => {
        console.log(`\n   Request ${index + 1}:`);
        console.log(`   - PK: ${request.PK}`);
        console.log(`   - SK: ${request.SK}`);
        console.log(`   - Status: ${request.status}`);
        console.log(`   - Requester Email: ${request.requesterEmail}`);
        console.log(`   - Requester Username: ${request.requesterUsername || 'NOT SET'}`);
        console.log(`   - Requested Username: ${request.requestedUsername || 'NOT SET'}`);
        console.log(`   - Requested At: ${request.requestedAt}`);
        console.log(`   - Is Private Stream Request: ${request.isPrivateStreamRequest || false}`);
      });
      
      // Check for pending requests specifically
      const pendingRequests = allRequests.filter(r => r.status === 'pending');
      console.log(`\n✅ Pending requests: ${pendingRequests.length}`);
      if (pendingRequests.length > 0) {
        console.log(`   These should appear in the received requests list`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkTwillyTVRequest()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
