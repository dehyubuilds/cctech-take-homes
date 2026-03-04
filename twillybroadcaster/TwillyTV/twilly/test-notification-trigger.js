const AWS = require('aws-sdk');
const https = require('https');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const mainTable = 'Twilly';
const messagingTable = 'TwillyMessaging';

// Backend API endpoint
const API_BASE_URL = 'https://twilly.app/api';

async function triggerNotification() {
  console.log('\n🔔 Triggering test notification on latest Twilly TV video...\n');
  
  try {
    // Step 1: Find latest video in Twilly TV timeline
    console.log('📋 Step 1: Finding latest Twilly TV video...');
    
    const creatorEmail = 'dehyu.sinyan@gmail.com';
    
    const videoParams = {
      TableName: mainTable,
      FilterExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${creatorEmail}`,
        ':sk': 'FILE#'
      },
      Limit: 50
    };
    
    const videoResult = await dynamodb.scan(videoParams).promise();
    
    if (!videoResult.Items || videoResult.Items.length === 0) {
      console.log('❌ No videos found for Twilly TV');
      return;
    }
    
    const sortedVideos = videoResult.Items.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.timestamp || 0);
      const timeB = new Date(b.createdAt || b.timestamp || 0);
      return timeB - timeA;
    });
    
    const latestVideo = sortedVideos[0];
    const videoId = latestVideo.SK?.replace('FILE#', '') || latestVideo.id;
    const normalizedVideoId = videoId.startsWith('file-') ? videoId.replace('file-', '') : videoId;
    
    console.log(`✅ Found latest video: ${videoId}`);
    console.log(`   Title: ${latestVideo.title || 'N/A'}`);
    console.log(`   Created: ${latestVideo.createdAt || latestVideo.timestamp || 'N/A'}\n`);
    
    // Step 2: Get user info
    console.log('📋 Step 2: Getting user info...');
    
    const twillyTVEmail = 'dehyu.sinyan@gmail.com';
    const dehyuEmail = 'dehyu.sinyan@gmail.com';
    
    const twillyProfileParams = {
      TableName: mainTable,
      Key: {
        PK: `USER#${twillyTVEmail}`,
        SK: 'PROFILE'
      }
    };
    
    const twillyProfile = await dynamodb.get(twillyProfileParams).promise();
    const twillyUserId = twillyProfile.Item?.userId || twillyTVEmail;
    const twillyUsername = twillyProfile.Item?.username || 'Twilly TV';
    
    console.log(`✅ Twilly TV: ${twillyUsername} (${twillyUserId})\n`);
    
    // Step 3: Find or create parent comment
    console.log('📋 Step 3: Finding parent comment for private thread...');
    
    const commentsParams = {
      TableName: messagingTable,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `VIDEO#${normalizedVideoId}`,
        ':sk': 'COMMENT#'
      },
      ScanIndexForward: false,
      Limit: 10
    };
    
    const commentsResult = await dynamodb.query(commentsParams).promise();
    const comments = commentsResult.Items || [];
    
    let parentCommentId = null;
    for (const comment of comments) {
      if (comment.username && comment.username.toLowerCase().includes('dehyuusername')) {
        parentCommentId = comment.commentId || comment.SK.replace('COMMENT#', '').split('_')[1];
        break;
      }
    }
    
    if (!parentCommentId) {
      console.log('   Creating parent comment first...');
      const parentCommentId_new = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const parentTimestamp = new Date().toISOString();
      const parentSortKey = `COMMENT#${Date.now()}_${parentCommentId_new}`;
      
      await dynamodb.put({
        TableName: messagingTable,
        Item: {
          PK: `VIDEO#${normalizedVideoId}`,
          SK: parentSortKey,
          commentId: parentCommentId_new,
          videoId: normalizedVideoId,
          userId: dehyuEmail,
          username: 'dehyuusername',
          text: 'Test parent comment for notification',
          createdAt: parentTimestamp,
          timestamp: parentTimestamp,
          likeCount: 0,
          isLiked: false,
          status: 'ACTIVE',
          isPrivate: false,
          parentCommentId: null,
          visibleTo: null,
          mentionedUsername: null
        }
      }).promise();
      
      parentCommentId = parentCommentId_new;
      console.log(`   ✅ Created parent comment: ${parentCommentId}\n`);
    } else {
      console.log(`   ✅ Found existing parent comment: ${parentCommentId}\n`);
    }
    
    // Step 4: Post via backend API (triggers full notification flow)
    console.log('📋 Step 4: Posting private message via backend API...');
    
    const commentText = `🔔 Test notification message at ${new Date().toLocaleTimeString()}`;
    const apiUrl = `${API_BASE_URL}/comments/post`;
    const postData = JSON.stringify({
      videoId: normalizedVideoId,
      userId: twillyUserId,
      username: twillyUsername,
      text: commentText,
      parentCommentId: parentCommentId,
      creatorEmail: creatorEmail,
      commenterEmail: dehyuEmail
    });
    
    console.log(`   Calling: ${apiUrl}`);
    console.log(`   Video: ${normalizedVideoId}`);
    console.log(`   Thread: ${parentCommentId}`);
    console.log(`   From: ${twillyUsername} → To: dehyuusername\n`);
    
    // Make HTTP POST request
    const url = require('url');
    const parsedUrl = url.parse(apiUrl);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ Backend API response (${res.statusCode}):`);
            try {
              const response = JSON.parse(data);
              console.log(`   Comment ID: ${response.commentId || 'N/A'}`);
              console.log(`   Success: ${response.success || 'N/A'}\n`);
            } catch (e) {
              console.log(`   Response: ${data.substring(0, 200)}\n`);
            }
            
            console.log('📋 Backend should have triggered notifications:');
            console.log('   1. ✅ Detected private message');
            console.log('   2. ✅ Found recipient (dehyuusername)');
            console.log('   3. ✅ Sent WebSocket unread_count_update');
            console.log('   4. ✅ Updated unread counts\n');
            
            console.log('✅ Test message posted successfully!');
            console.log(`\n📱 Check your iOS app - you should see:`);
            console.log(`   1. Red badge on comment icon for video: ${normalizedVideoId}`);
            console.log(`   2. Orange highlight on "Twilly TV" username in scroll bar`);
            console.log(`   3. Unread count updated via WebSocket\n`);
            
            resolve();
          } else {
            console.error(`❌ Backend API error (${res.statusCode}): ${data.substring(0, 500)}`);
            reject(new Error(`API returned ${res.statusCode}`));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`❌ Request error: ${error.message}`);
        console.log('\n⚠️  Could not reach backend API. Check your network connection.\n');
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run
triggerNotification().catch(console.error);
