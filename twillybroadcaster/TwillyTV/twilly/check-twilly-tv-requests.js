import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkTwillyTVRequests() {
  const targetUsername = 'Twilly TV';
  console.log(`🔍 Checking follow requests for username: "${targetUsername}"\n`);
  console.log('='.repeat(60));

  try {
    // Step 1: Find the email associated with "Twilly TV" username
    console.log('\n1️⃣ FINDING USER EMAIL FOR "Twilly TV":');
    console.log('-'.repeat(60));
    
    // Try GSI first
    let twillyTVEmail = null;
    let twillyTVProfile = null;
    
    try {
      const gsiParams = {
        TableName: table,
        IndexName: 'UsernameSearchIndex',
        KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
        ExpressionAttributeValues: {
          ':visibility': 'public',
          ':username': targetUsername
        }
      };
      
      const gsiResult = await dynamodb.query(gsiParams).promise();
      if (gsiResult.Items && gsiResult.Items.length > 0) {
        twillyTVProfile = gsiResult.Items[0];
        if (twillyTVProfile.PK && twillyTVProfile.PK.startsWith('USER#')) {
          twillyTVEmail = twillyTVProfile.PK.replace('USER#', '');
          console.log(`✅ Found via GSI: ${twillyTVEmail}`);
        }
      }
    } catch (gsiError) {
      console.log(`⚠️  GSI lookup failed: ${gsiError.message}`);
    }
    
    // If not found via GSI, try PROFILE scan
    if (!twillyTVEmail) {
      console.log('   Trying PROFILE scan...');
      const profileScanParams = {
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pkPrefix': 'USER#',
          ':sk': 'PROFILE'
        }
      };

      let allProfiles = [];
      let lastEvaluatedKey = null;
      
      do {
        const paginatedParams = {
          ...profileScanParams,
          ExclusiveStartKey: lastEvaluatedKey
        };
        const result = await dynamodb.scan(paginatedParams).promise();
        allProfiles = allProfiles.concat(result.Items || []);
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      const targetProfile = allProfiles.find(profile => {
        if (!profile.username) return false;
        return profile.username.toLowerCase() === targetUsername.toLowerCase();
      });
      
      if (targetProfile) {
        twillyTVProfile = targetProfile;
        if (targetProfile.PK && targetProfile.PK.startsWith('USER#')) {
          twillyTVEmail = targetProfile.PK.replace('USER#', '');
          console.log(`✅ Found via PROFILE scan: ${twillyTVEmail}`);
        }
      }
    }
    
    if (!twillyTVEmail) {
      console.log(`❌ Could not find email for username: "${targetUsername}"`);
      return;
    }
    
    console.log(`\n📧 Email associated with "Twilly TV": ${twillyTVEmail}`);
    console.log(`   PK: ${twillyTVProfile.PK}`);
    console.log(`   SK: ${twillyTVProfile.SK}`);
    console.log(`   Username: ${twillyTVProfile.username || 'N/A'}`);
    console.log(`   Visibility: ${twillyTVProfile.usernameVisibility || 'N/A'}`);

    // Step 2: Query for all follow requests for this email
    console.log(`\n2️⃣ CHECKING FOLLOW REQUESTS FOR ${twillyTVEmail}:`);
    console.log('-'.repeat(60));
    
    const requestParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${twillyTVEmail}`,
        ':skPrefix': 'FOLLOW_REQUEST#'
      }
    };
    
    const requestResult = await dynamodb.query(requestParams).promise();
    const allRequests = requestResult.Items || [];
    
    console.log(`\n📊 Total follow requests found: ${allRequests.length}`);
    
    if (allRequests.length === 0) {
      console.log(`\n⚠️  No follow requests found for "${targetUsername}" (${twillyTVEmail})`);
      console.log(`   This means either:`);
      console.log(`   1. No requests have been made yet`);
      console.log(`   2. Requests were deleted`);
      console.log(`   3. Requests are stored under a different email`);
    } else {
      console.log(`\n📋 All Follow Requests:`);
      for (let i = 0; i < allRequests.length; i++) {
        const request = allRequests[i];
        const requesterEmail = request.requesterEmail || request.SK?.replace('FOLLOW_REQUEST#', '');
        
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
        
        console.log(`\n   Request #${i + 1}:`);
        console.log(`      Requester: ${requesterUsername} (${requesterEmail})`);
        console.log(`      Status: ${request.status || 'N/A'}`);
        console.log(`      Requested At: ${requestedAt}`);
        console.log(`      Responded At: ${respondedAt}`);
        console.log(`      Requested Username: ${request.requestedUsername || 'N/A'}`);
        console.log(`      Is Private Stream Request: ${request.isPrivateStreamRequest || false}`);
        console.log(`      SK: ${request.SK}`);
      }
    }

    // Step 3: Check for recent notifications
    console.log(`\n3️⃣ CHECKING RECENT NOTIFICATIONS FOR ${twillyTVEmail}:`);
    console.log('-'.repeat(60));
    
    const notificationParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${twillyTVEmail}`,
        ':skPrefix': 'NOTIFICATION#'
      },
      ScanIndexForward: false, // Most recent first
      Limit: 20
    };
    
    const notificationResult = await dynamodb.query(notificationParams).promise();
    const notifications = notificationResult.Items || [];
    
    const followRequestNotifications = notifications.filter(n => n.type === 'follow_request');
    
    console.log(`\n📬 Total notifications: ${notifications.length}`);
    console.log(`📩 Follow request notifications: ${followRequestNotifications.length}`);
    
    if (followRequestNotifications.length > 0) {
      console.log(`\n📋 Recent Follow Request Notifications:`);
      for (let i = 0; i < Math.min(followRequestNotifications.length, 10); i++) {
        const notif = followRequestNotifications[i];
        const createdAt = notif.createdAt ? new Date(notif.createdAt).toLocaleString() : 'N/A';
        console.log(`\n   Notification #${i + 1}:`);
        console.log(`      Title: ${notif.title || 'N/A'}`);
        console.log(`      Message: ${notif.message || 'N/A'}`);
        console.log(`      Created At: ${createdAt}`);
        console.log(`      Is Read: ${notif.isRead || false}`);
        console.log(`      Requester: ${notif.metadata?.requesterUsername || notif.metadata?.requesterEmail || 'N/A'}`);
        console.log(`      SK: ${notif.SK}`);
      }
    } else {
      console.log(`\n⚠️  No follow request notifications found`);
    }

    // Step 4: Check if there are any requests from the last 24 hours
    console.log(`\n4️⃣ RECENT ACTIVITY (LAST 24 HOURS):`);
    console.log('-'.repeat(60));
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentRequests = allRequests.filter(req => {
      if (!req.requestedAt) return false;
      return req.requestedAt >= oneDayAgo;
    });
    
    const recentNotifications = followRequestNotifications.filter(notif => {
      if (!notif.createdAt) return false;
      return notif.createdAt >= oneDayAgo;
    });
    
    console.log(`\n📊 Recent Requests (last 24h): ${recentRequests.length}`);
    console.log(`📊 Recent Notifications (last 24h): ${recentNotifications.length}`);
    
    if (recentRequests.length > 0 || recentNotifications.length > 0) {
      console.log(`\n✅ There IS recent activity!`);
    } else {
      console.log(`\n⚠️  No activity in the last 24 hours`);
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error);
  }
}

checkTwillyTVRequests();
