const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const messagingTable = 'TwillyMessaging';

async function checkRecentComments() {
  console.log('\n🔍 Checking recent comments in DynamoDB (last 1 hour)...\n');
  
  try {
    // Get all recent comments from last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    console.log(`📅 Looking for comments after: ${oneHourAgo}\n`);
    
    // Scan for recent comments
    const params = {
      TableName: messagingTable,
      FilterExpression: 'createdAt >= :time OR #ts >= :time',
      ExpressionAttributeNames: {
        '#ts': 'timestamp'
      },
      ExpressionAttributeValues: {
        ':time': oneHourAgo
      },
      Limit: 100
    };
    
    const result = await dynamodb.scan(params).promise();
    
    if (result.Items && result.Items.length > 0) {
      console.log(`✅ Found ${result.Items.length} recent comment(s):\n`);
      
      // Sort by creation time (newest first)
      result.Items.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.timestamp || 0);
        const timeB = new Date(b.createdAt || b.timestamp || 0);
        return timeB - timeA;
      });
      
      // Filter for Twilly TV or dehyuusername
      const relevantComments = result.Items.filter(comment => {
        const username = (comment.username || '').toLowerCase();
        const text = (comment.text || '').toLowerCase();
        return username.includes('twilly tv') || 
               username.includes('dehyuusername') ||
               text.includes('twilly tv') ||
               text.includes('dehyuusername');
      });
      
      if (relevantComments.length > 0) {
        console.log(`📬 Found ${relevantComments.length} relevant comment(s) involving Twilly TV or dehyuusername:\n`);
        
        relevantComments.forEach((comment, index) => {
          const time = new Date(comment.createdAt || comment.timestamp || 0).toISOString();
          console.log(`${index + 1}. [${time}]`);
          console.log(`   Video ID: ${comment.videoId || comment.PK?.replace('VIDEO#', '') || 'N/A'}`);
          console.log(`   Comment ID: ${comment.commentId || comment.SK || 'N/A'}`);
          console.log(`   Username: ${comment.username || 'N/A'}`);
          console.log(`   Text: ${comment.text || 'N/A'}`);
          console.log(`   Private: ${comment.isPrivate || false}`);
          console.log(`   Parent Comment ID: ${comment.parentCommentId || 'none'}`);
          console.log(`   VisibleTo: [${(comment.visibleTo || []).join(', ') || 'none'}]`);
          console.log(`   UserId: ${comment.userId || 'N/A'}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No comments found involving Twilly TV or dehyuusername in last hour');
        console.log('\n📋 Showing all recent comments instead:\n');
        
        result.Items.slice(0, 10).forEach((comment, index) => {
          const time = new Date(comment.createdAt || comment.timestamp || 0).toISOString();
          console.log(`${index + 1}. [${time}] ${comment.username || 'N/A'}: ${(comment.text || '').substring(0, 50)}...`);
          console.log(`   Private: ${comment.isPrivate || false}, VisibleTo: [${(comment.visibleTo || []).join(', ') || 'none'}]`);
        });
      }
    } else {
      console.log('⚠️  No recent comments found in last hour');
      console.log('   This might mean:');
      console.log('   1. No comments were posted');
      console.log('   2. Comments are in a different table');
      console.log('   3. Timestamp format is different\n');
    }
    
    // Also check for any comments with Twilly TV or dehyuusername in username
    console.log('\n🔍 Checking for any comments with Twilly TV or dehyuusername username...\n');
    
    const usernameParams = {
      TableName: messagingTable,
      FilterExpression: 'contains(username, :twilly) OR contains(username, :dehyu)',
      ExpressionAttributeValues: {
        ':twilly': 'Twilly TV',
        ':dehyu': 'dehyuusername'
      },
      Limit: 20
    };
    
    const usernameResult = await dynamodb.scan(usernameParams).promise();
    
    if (usernameResult.Items && usernameResult.Items.length > 0) {
      console.log(`✅ Found ${usernameResult.Items.length} comment(s) with relevant usernames:\n`);
      
      usernameResult.Items.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.timestamp || 0);
        const timeB = new Date(b.createdAt || b.timestamp || 0);
        return timeB - timeA;
      });
      
      usernameResult.Items.slice(0, 10).forEach((comment, index) => {
        const time = new Date(comment.createdAt || comment.timestamp || 0).toISOString();
        console.log(`${index + 1}. [${time}] ${comment.username || 'N/A'}`);
        console.log(`   Video: ${comment.videoId || comment.PK?.replace('VIDEO#', '') || 'N/A'}`);
        console.log(`   Private: ${comment.isPrivate || false}`);
        console.log(`   VisibleTo: [${(comment.visibleTo || []).join(', ') || 'none'}]`);
        console.log(`   Parent: ${comment.parentCommentId || 'none'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking DynamoDB:', error.message);
    console.error(error.stack);
  }
}

// Run
checkRecentComments().catch(console.error);
