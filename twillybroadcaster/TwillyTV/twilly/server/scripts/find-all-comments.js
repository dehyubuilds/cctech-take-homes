const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findAllComments() {
  console.log('🔍 Searching for all comments in the database...\n');
  
  // Scan for all items with PK starting with VIDEO#
  const params = {
    TableName: table,
    FilterExpression: 'begins_with(PK, :pk)',
    ExpressionAttributeValues: {
      ':pk': 'VIDEO#'
    }
  };
  
  try {
    const result = await dynamodb.scan(params).promise();
    console.log(`✅ Found ${result.Items?.length || 0} items with PK starting with VIDEO#\n`);
    
    if (result.Items && result.Items.length > 0) {
      // Group by videoId
      const byVideo = {};
      result.Items.forEach(item => {
        const videoId = item.videoId || item.PK.replace('VIDEO#', '');
        if (!byVideo[videoId]) {
          byVideo[videoId] = [];
        }
        byVideo[videoId].push(item);
      });
      
      console.log(`📊 Found comments for ${Object.keys(byVideo).length} different videos:\n`);
      
      for (const [videoId, comments] of Object.entries(byVideo)) {
        console.log(`\n📹 Video: ${videoId}`);
        console.log(`   Total comments: ${comments.length}`);
        
        const publicComments = comments.filter(c => !c.isPrivate && !c.parentCommentId);
        const privateComments = comments.filter(c => c.isPrivate || c.parentCommentId);
        
        console.log(`   - Public: ${publicComments.length}`);
        console.log(`   - Private/Thread: ${privateComments.length}`);
        
        if (privateComments.length > 0) {
          console.log(`   Private thread details:`);
          const byThread = {};
          privateComments.forEach(c => {
            const threadId = c.parentCommentId || c.commentId;
            if (!byThread[threadId]) {
              byThread[threadId] = [];
            }
            byThread[threadId].push(c);
          });
          
          for (const [threadId, threadMessages] of Object.entries(byThread)) {
            console.log(`     Thread ${threadId}: ${threadMessages.length} messages`);
            threadMessages.forEach(msg => {
              console.log(`       - ${msg.username}: ${msg.text?.substring(0, 40)}... (visibleTo: ${JSON.stringify(msg.visibleTo)})`);
            });
          }
        }
      }
    } else {
      console.log('⚠️ No comments found in the database at all!');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findAllComments().catch(console.error);
