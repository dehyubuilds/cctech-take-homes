import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkDehyubuildsUsername() {
  const email = 'dehyubuilds@gmail.com';
  console.log(`🔍 Checking username for: ${email}\n`);
  console.log('='.repeat(60));

  try {
    // Check PROFILE (this is what the backend uses)
    console.log('\n1️⃣ PROFILE LOOKUP (PK=USER#email, SK=PROFILE):');
    console.log('-'.repeat(60));
    const profileParams = {
      TableName: table,
      Key: {
        PK: `USER#${email}`,
        SK: 'PROFILE'
      }
    };
    const profileResult = await dynamodb.get(profileParams).promise();
    if (profileResult.Item) {
      console.log(`✅ Found PROFILE:`);
      console.log(`   Username: ${profileResult.Item.username || 'N/A'}`);
      console.log(`   Private Username: ${profileResult.Item.privateUsername || 'N/A'}`);
      console.log(`   Visibility: ${profileResult.Item.usernameVisibility || 'N/A'}`);
      console.log(`   PK: ${profileResult.Item.PK}`);
      console.log(`   SK: ${profileResult.Item.SK}`);
    } else {
      console.log(`❌ No PROFILE found`);
    }

    // Check USER record (PK=USER, SK=userId)
    console.log('\n2️⃣ USER RECORD LOOKUP (PK=USER, SK=userId):');
    console.log('-'.repeat(60));
    const userScanParams = {
      TableName: table,
      FilterExpression: 'PK = :pk AND email = :email',
      ExpressionAttributeValues: {
        ':pk': 'USER',
        ':email': email
      }
    };
    const userScanResult = await dynamodb.scan(userScanParams).promise();
    if (userScanResult.Items && userScanResult.Items.length > 0) {
      console.log(`✅ Found ${userScanResult.Items.length} USER record(s):`);
      for (const item of userScanResult.Items) {
        console.log(`   Username: ${item.username || 'N/A'}`);
        console.log(`   Email: ${item.email || 'N/A'}`);
        console.log(`   UserId: ${item.userId || item.SK || 'N/A'}`);
        console.log(`   PK: ${item.PK}`);
        console.log(`   SK: ${item.SK}`);
      }
    } else {
      console.log(`❌ No USER record found`);
    }

    // Check GSI for username
    console.log('\n3️⃣ GSI LOOKUP (UsernameSearchIndex):');
    console.log('-'.repeat(60));
    try {
      const gsiParams = {
        TableName: table,
        IndexName: 'UsernameSearchIndex',
        KeyConditionExpression: 'usernameVisibility = :visibility',
        FilterExpression: 'email = :email OR userEmail = :email',
        ExpressionAttributeValues: {
          ':visibility': 'public',
          ':email': email
        }
      };
      const gsiResult = await dynamodb.query(gsiParams).promise();
      if (gsiResult.Items && gsiResult.Items.length > 0) {
        console.log(`✅ Found ${gsiResult.Items.length} GSI record(s):`);
        for (const item of gsiResult.Items) {
          console.log(`   Username: ${item.username || 'N/A'}`);
          console.log(`   Visibility: ${item.usernameVisibility || 'N/A'}`);
        }
      } else {
        console.log(`❌ No GSI record found`);
      }
    } catch (gsiError) {
      console.log(`⚠️  GSI lookup failed: ${gsiError.message}`);
    }

    // Check what username is stored in the follow request
    console.log('\n4️⃣ FOLLOW REQUEST DATA:');
    console.log('-'.repeat(60));
    const requestParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FOLLOW_REQUEST#dehyubuilds@gmail.com'
      }
    };
    const requestResult = await dynamodb.query(requestParams).promise();
    if (requestResult.Items && requestResult.Items.length > 0) {
      const request = requestResult.Items[0];
      console.log(`✅ Found follow request:`);
      console.log(`   Requester Email: ${request.requesterEmail || 'N/A'}`);
      console.log(`   Requested Username: ${request.requestedUsername || 'N/A'}`);
      console.log(`   Status: ${request.status || 'N/A'}`);
    } else {
      console.log(`❌ No follow request found`);
    }

    // Check notification
    console.log('\n5️⃣ NOTIFICATION DATA:');
    console.log('-'.repeat(60));
    const notificationScanParams = {
      TableName: table,
      FilterExpression: 'PK = :pk AND begins_with(SK, :skPrefix) AND #type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':skPrefix': 'NOTIFICATION#',
        ':type': 'follow_request'
      }
    };
    const notificationResult = await dynamodb.scan(notificationScanParams).promise();
    const notifications = notificationResult.Items || [];
    const recentNotif = notifications
      .filter(n => n.metadata?.requesterEmail === email)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    
    if (recentNotif) {
      console.log(`✅ Found most recent notification:`);
      console.log(`   Title: ${recentNotif.title || 'N/A'}`);
      console.log(`   Message: ${recentNotif.message || 'N/A'}`);
      console.log(`   Requester Username (metadata): ${recentNotif.metadata?.requesterUsername || 'N/A'}`);
      console.log(`   Requester Email (metadata): ${recentNotif.metadata?.requesterEmail || 'N/A'}`);
      console.log(`   Created At: ${recentNotif.createdAt || 'N/A'}`);
    } else {
      console.log(`❌ No notification found`);
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error);
  }
}

checkDehyubuildsUsername();
