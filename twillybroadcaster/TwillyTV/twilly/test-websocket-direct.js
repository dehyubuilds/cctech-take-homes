const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda({ region: 'us-east-1' });

async function sendDirectWebSocketNotification() {
  console.log('\n🔔 Sending DIRECT WebSocket notification to trigger indicator...\n');
  
  try {
    // Get user email (dehyuusername)
    const userEmail = 'dehyu.sinyan@gmail.com';
    
    // Use the video ID from the test we ran earlier
    const normalizedVideoId = '1745359252571-vbmuzco1m';
    
    console.log(`✅ Using video: ${normalizedVideoId}\n`);
    
    // Send DIRECT WebSocket notification via Lambda
    const message = {
      type: 'unread_count_update',
      videoId: normalizedVideoId,
      totalUnread: 1,
      threadUnreadCounts: {
        'test_thread_123': 1
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 Sending WebSocket message:');
    console.log(JSON.stringify(message, null, 2));
    console.log(`\n   To user: ${userEmail}\n`);
    
    // Invoke Lambda to send WebSocket message
    const lambdaParams = {
      FunctionName: 'websocket-comments-send',
      InvocationType: 'Event',
      Payload: JSON.stringify({
        userEmails: [userEmail],
        messageType: 'unread_count_update',
        data: {
          videoId: normalizedVideoId,
          totalUnread: 1,
          threadUnreadCounts: {
            'test_thread_123': 1
          }
        }
      })
    };
    
    const result = await lambda.invoke(lambdaParams).promise();
    console.log('✅ Lambda invoked successfully!');
    console.log(`   Status: ${result.StatusCode}`);
    console.log(`\n📱 Check your iOS app NOW - you should see:`);
    console.log(`   1. Red badge on comment icon`);
    console.log(`   2. Orange highlight on username`);
    console.log(`\n   If you don't see it, check:`);
    console.log(`   - WebSocket connection status in Xcode console`);
    console.log(`   - User email matches: ${userEmail}`);
    console.log(`   - Video ID matches: ${normalizedVideoId}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run
sendDirectWebSocketNotification().catch(console.error);
