import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkRecentActivity() {
  console.log(`🔍 Checking ALL recent follow request activity\n`);
  console.log('='.repeat(60));

  try {
    // Scan for ALL follow requests (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const scanParams = {
      TableName: table,
      FilterExpression: 'begins_with(SK, :skPrefix) AND requestedAt >= :date',
      ExpressionAttributeValues: {
        ':skPrefix': 'FOLLOW_REQUEST#',
        ':date': sevenDaysAgo
      }
    };

    let allRequests = [];
    let lastEvaluatedKey = null;
    
    do {
      const paginatedParams = {
        ...scanParams,
        ExclusiveStartKey: lastEvaluatedKey
      };
      const result = await dynamodb.scan(paginatedParams).promise();
      allRequests = allRequests.concat(result.Items || []);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`\n📊 Total follow requests (last 7 days): ${allRequests.length}\n`);

    // Sort by requestedAt (most recent first)
    allRequests.sort((a, b) => {
      const dateA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const dateB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Group by requested username
    const byUsername = {};
    for (const req of allRequests) {
      const username = req.requestedUsername || 'Unknown';
      if (!byUsername[username]) {
        byUsername[username] = [];
      }
      byUsername[username].push(req);
    }

    console.log(`📋 Requests by Username:\n`);
    for (const [username, requests] of Object.entries(byUsername)) {
      console.log(`   "${username}": ${requests.length} request(s)`);
      for (const req of requests) {
        const requesterEmail = req.requesterEmail || req.SK?.replace('FOLLOW_REQUEST#', '');
        const requestedAt = req.requestedAt ? new Date(req.requestedAt).toLocaleString() : 'N/A';
        console.log(`      - From: ${requesterEmail}, Status: ${req.status}, At: ${requestedAt}`);
      }
    }

    // Check for "Twilly TV" specifically
    const twillyTVRequests = allRequests.filter(r => 
      r.requestedUsername && r.requestedUsername.toLowerCase() === 'twilly tv'
    );
    
    console.log(`\n📺 "Twilly TV" Requests: ${twillyTVRequests.length}`);
    if (twillyTVRequests.length > 0) {
      const pending = twillyTVRequests.filter(r => r.status === 'pending');
      const accepted = twillyTVRequests.filter(r => r.status === 'accepted');
      const declined = twillyTVRequests.filter(r => r.status === 'declined');
      
      console.log(`   Pending: ${pending.length}`);
      console.log(`   Accepted: ${accepted.length}`);
      console.log(`   Declined: ${declined.length}`);
      
      if (pending.length > 0) {
        console.log(`\n⚠️  There ARE pending requests that should appear in inbox!`);
        for (const req of pending) {
          const requesterEmail = req.requesterEmail || req.SK?.replace('FOLLOW_REQUEST#', '');
          console.log(`   - From: ${requesterEmail}`);
        }
      }
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error);
  }
}

checkRecentActivity();
