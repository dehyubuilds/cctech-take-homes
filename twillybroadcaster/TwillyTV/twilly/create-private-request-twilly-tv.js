const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function createPrivateRequest() {
  try {
    // Request from: dehyubuilds@gmail.com (dehyuusername)
    // Request to: dehyu.sinyan@gmail.com (Twilly TV)
    const requesterEmail = 'dehyubuilds@gmail.com';
    const requesterUsername = 'dehyuusername';
    const requestedUserEmail = 'dehyu.sinyan@gmail.com';
    const requestedUsername = 'Twilly TV'; // PROFILE username
    
    console.log(`📝 Creating PRIVATE follow request:`);
    console.log(`   From: ${requesterEmail} (${requesterUsername})`);
    console.log(`   To: ${requestedUserEmail} (${requestedUsername})`);
    console.log(`   Type: PRIVATE STREAM REQUEST`);
    
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
      if (existing.Item.status === 'pending') {
        console.log(`   ✅ Request is already pending - this should appear in received requests!`);
        return;
      }
      console.log(`   Deleting existing request first...`);
      await dynamodb.delete(existingParams).promise();
      console.log(`   ✅ Deleted existing request`);
    }
    
    // Create the follow request with isPrivateStreamRequest: true
    const requestParams = {
      TableName: table,
      Item: {
        PK: `USER#${requestedUserEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        requesterEmail: requesterEmail,
        requesterUsername: requesterUsername,
        requestedUsername: requestedUsername, // PROFILE username
        isPrivateStreamRequest: true // CRITICAL: This is a private request
      }
    };
    
    await dynamodb.put(requestParams).promise();
    
    console.log(`✅ Successfully created PRIVATE follow request!`);
    console.log(`   PK: USER#${requestedUserEmail}`);
    console.log(`   SK: FOLLOW_REQUEST#${requesterEmail}`);
    console.log(`   Status: pending`);
    console.log(`   isPrivateStreamRequest: true`);
    
    // Create notification
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
      console.log(`\n✅ Created notification for requested user`);
    } catch (notificationError) {
      console.error(`⚠️  Failed to create notification: ${notificationError.message}`);
    }
    
    // Verify it was created
    const verify = await dynamodb.get(existingParams).promise();
    if (verify.Item) {
      console.log(`\n✅ Verification: Request exists in database`);
      console.log(`   Status: ${verify.Item.status}`);
      console.log(`   isPrivateStreamRequest: ${verify.Item.isPrivateStreamRequest}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

createPrivateRequest()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
