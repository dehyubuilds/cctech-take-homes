const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkCommentPK() {
  console.log('🔍 Checking PK format of existing comments...\n');
  
  // Get all comments
  const params = {
    TableName: table,
    FilterExpression: 'begins_with(PK, :pk)',
    ExpressionAttributeValues: {
      ':pk': 'VIDEO#'
    }
  };
  
  try {
    const result = await dynamodb.scan(params).promise();
    console.log(`✅ Found ${result.Items?.length || 0} comments\n`);
    
    if (result.Items && result.Items.length > 0) {
      // Group by PK
      const byPK = {};
      result.Items.forEach(item => {
        if (!byPK[item.PK]) {
          byPK[item.PK] = [];
        }
        byPK[item.PK].push(item);
      });
      
      console.log(`📊 Found comments with ${Object.keys(byPK).length} different PKs:\n`);
      
      for (const [pk, comments] of Object.entries(byPK)) {
        console.log(`\n🔑 PK: ${pk}`);
        console.log(`   Comments: ${comments.length}`);
        console.log(`   Sample videoId from comments: ${comments[0].videoId}`);
        console.log(`   Sample SK: ${comments[0].SK}`);
        
        // Extract the videoId from PK (remove VIDEO# prefix)
        const videoIdFromPK = pk.replace('VIDEO#', '');
        console.log(`   VideoId from PK: ${videoIdFromPK}`);
        console.log(`   Match: ${comments[0].videoId === videoIdFromPK ? '✅' : '❌'}`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCommentPK().catch(console.error);
