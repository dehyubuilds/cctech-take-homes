const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function createMockFollowRequest() {
  try {
    // Request from: dehyu.sinyan@gmail.com (Twilly TV) 
    // Request to: dehyubuilds@gmail.com (dehyuusername)
    const requesterEmail = 'dehyu.sinyan@gmail.com';
    const requesterUsername = 'Twilly TV';
    const requestedUserEmail = 'dehyubuilds@gmail.com';
    const requestedUsername = 'dehyuusername';
    
    console.log(`📝 Creating mock follow request:`);
    console.log(`   From: ${requesterEmail} (${requesterUsername})`);
    console.log(`   To: ${requestedUserEmail} (${requestedUsername})`);
    
    // Check if request already exists
    const existingParams = {
      TableName: table,
      Key: {
        PK: `USER#${requestedUserEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`
      }
    };
    
    const existing = await dynamodb.get(existingParams).promise();
    if (existing.Item) {
      console.log(`⚠️  Follow request already exists with status: ${existing.Item.status}`);
      console.log(`   Deleting existing request first...`);
      await dynamodb.delete(existingParams).promise();
      console.log(`   ✅ Deleted existing request`);
    }
    
    // Create the follow request
    const requestParams = {
      TableName: table,
      Item: {
        PK: `USER#${requestedUserEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        requesterEmail: requesterEmail,
        requesterUsername: requesterUsername,
        requestedUsername: requestedUsername,
        isPrivateStreamRequest: true
      }
    };
    
    await dynamodb.put(requestParams).promise();
    
    console.log(`✅ Successfully created mock follow request!`);
    console.log(`   PK: USER#${requestedUserEmail}`);
    console.log(`   SK: FOLLOW_REQUEST#${requesterEmail}`);
    console.log(`   Status: pending`);
    console.log(`   Requester: ${requesterUsername} (${requesterEmail})`);
    console.log(`   Requested: ${requestedUsername} (${requestedUserEmail})`);
    
    // CRITICAL: Create notification for the requested user
    try {
      const notificationParams = {
        TableName: table,
        Item: {
          PK: `USER#${requestedUserEmail}`,
          SK: `NOTIFICATION#${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'follow_request',
          title: 'New Follow Request',
          message: `${requesterUsername} wants to follow you`,
          metadata: {
            requesterEmail: requesterEmail,
            requesterUsername: requesterUsername,
            requestedUsername: requestedUsername
          },
          isRead: false,
          createdAt: new Date().toISOString()
        }
      };
      
      await dynamodb.put(notificationParams).promise();
      console.log(`\n✅ Created notification for requested user: ${requestedUserEmail}`);
      console.log(`   📧 Notification PK: USER#${requestedUserEmail}`);
      console.log(`   📝 Notification message: ${requesterUsername} wants to follow you`);
    } catch (notificationError) {
      console.error(`⚠️  Failed to create notification: ${notificationError.message}`);
    }
    
    // Verify it was created
    const verifyParams = {
      TableName: table,
      Key: {
        PK: `USER#${requestedUserEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`
      }
    };
    
    const verify = await dynamodb.get(verifyParams).promise();
    if (verify.Item) {
      console.log(`\n✅ Verification: Request exists in database`);
      console.log(`   ${JSON.stringify(verify.Item, null, 2)}`);
    } else {
      console.log(`\n❌ ERROR: Request was not created!`);
    }
    
  } catch (error) {
    console.error('❌ Error creating mock follow request:', error);
    throw error;
  }
}

// Run the script
createMockFollowRequest()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
