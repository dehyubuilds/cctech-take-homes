import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkAllRecentRequests() {
  console.log(`🔍 Checking ALL recent follow requests for "Twilly TV"\n`);
  console.log('='.repeat(60));

  try {
    // Scan for all follow requests that mention "Twilly TV" in requestedUsername
    const scanParams = {
      TableName: table,
      FilterExpression: 'begins_with(SK, :skPrefix) AND requestedUsername = :username',
      ExpressionAttributeValues: {
        ':skPrefix': 'FOLLOW_REQUEST#',
        ':username': 'Twilly TV'
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

    console.log(`\n📊 Total follow requests for "Twilly TV": ${allRequests.length}\n`);

    if (allRequests.length === 0) {
      console.log(`⚠️  No follow requests found for "Twilly TV"`);
      return;
    }

    // Sort by requestedAt (most recent first)
    allRequests.sort((a, b) => {
      const dateA = a.requestedAt ? new Date(a.requestedAt).getTime() : 0;
      const dateB = b.requestedAt ? new Date(b.requestedAt).getTime() : 0;
      return dateB - dateA;
    });

    console.log(`📋 All Follow Requests (sorted by most recent):\n`);
    for (let i = 0; i < allRequests.length; i++) {
      const request = allRequests[i];
      const requesterEmail = request.requesterEmail || request.SK?.replace('FOLLOW_REQUEST#', '');
      const requestedUserEmail = request.PK?.replace('USER#', '') || 'Unknown';
      
      // Get requester's username
      let requesterUsername = 'Unknown';
      try {
        const requesterProfileParams = {
          TableName: table,
          Key: {
            PK: `USER#${requesterEmail}`,
            SK: 'PROFILE'
          }
        };
        const requesterProfile = await dynamodb.get(requesterProfileParams).promise();
        requesterUsername = requesterProfile.Item?.username || requesterEmail.split('@')[0];
      } catch (e) {
        requesterUsername = requesterEmail.split('@')[0];
      }
      
      const requestedAt = request.requestedAt ? new Date(request.requestedAt).toLocaleString() : 'N/A';
      const respondedAt = request.respondedAt ? new Date(request.respondedAt).toLocaleString() : 'N/A';
      const isRecent = request.requestedAt && new Date(request.requestedAt) > new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      console.log(`   Request #${i + 1}${isRecent ? ' 🆕 (RECENT)' : ''}:`);
      console.log(`      Requester: ${requesterUsername} (${requesterEmail})`);
      console.log(`      Requested User Email: ${requestedUserEmail}`);
      console.log(`      Status: ${request.status || 'N/A'}`);
      console.log(`      Requested At: ${requestedAt}`);
      console.log(`      Responded At: ${respondedAt}`);
      console.log(`      Requested Username: ${request.requestedUsername || 'N/A'}`);
      console.log(`      Is Private Stream Request: ${request.isPrivateStreamRequest || false}`);
      console.log(`      PK: ${request.PK}`);
      console.log(`      SK: ${request.SK}`);
      console.log('');
    }

    // Check for pending requests specifically
    const pendingRequests = allRequests.filter(r => r.status === 'pending');
    console.log(`\n📬 Pending Requests: ${pendingRequests.length}`);
    if (pendingRequests.length > 0) {
      console.log(`\n⚠️  There are ${pendingRequests.length} PENDING requests that should appear in the inbox!`);
      for (const req of pendingRequests) {
        const requesterEmail = req.requesterEmail || req.SK?.replace('FOLLOW_REQUEST#', '');
        console.log(`   - From: ${requesterEmail}`);
      }
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error);
  }
}

checkAllRecentRequests();
