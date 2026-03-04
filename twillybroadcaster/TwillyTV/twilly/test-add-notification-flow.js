const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function testAddNotificationFlow() {
  console.log('🔍 TESTING ADD PRIVATE VIEWER NOTIFICATION FLOW\n');
  console.log('='.repeat(80));
  
  // Test scenario: Twilly TV adds dehyuusername to private
  const ownerUsername = 'Twilly TV';
  const viewerUsername = 'dehyuusername';
  
  console.log(`\n📋 Test Scenario:`);
  console.log(`   Owner: ${ownerUsername}`);
  console.log(`   Viewer: ${viewerUsername}`);
  
  // Step 1: Resolve owner email
  console.log(`\n1️⃣ RESOLVING OWNER EMAIL (${ownerUsername}):`);
  console.log('-'.repeat(80));
  
  const normalizeUsernameForComparison = (username) => {
    if (!username) return '';
    return username.replace(/\s+/g, '').toLowerCase();
  };
  
  let ownerEmail = null;
  const ownerNormalized = normalizeUsernameForComparison(ownerUsername);
  
  // Try GSI lookup
  for (const visibility of ['public', 'private']) {
    const gsiParams = {
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
      ExpressionAttributeValues: {
        ':visibility': visibility,
        ':username': ownerUsername
      },
      Limit: 1
    };
    
    try {
      const gsiResult = await dynamodb.query(gsiParams).promise();
      if (gsiResult.Items && gsiResult.Items.length > 0) {
        const foundUser = gsiResult.Items.find(item => {
          if (!item.username) return false;
          return normalizeUsernameForComparison(item.username) === ownerNormalized;
        });
        if (foundUser) {
          ownerEmail = foundUser.email || (foundUser.PK?.replace('USER#', '') || null);
          if (ownerEmail) {
            console.log(`✅ Found owner email: ${ownerEmail}`);
            break;
          }
        }
      }
    } catch (error) {
      // Continue
    }
  }
  
  if (!ownerEmail) {
    console.log('❌ Could not resolve owner email');
    return;
  }
  
  // Step 2: Resolve viewer email
  console.log(`\n2️⃣ RESOLVING VIEWER EMAIL (${viewerUsername}):`);
  console.log('-'.repeat(80));
  
  let viewerEmail = null;
  const viewerNormalized = normalizeUsernameForComparison(viewerUsername);
  
  // Try GSI lookup
  for (const visibility of ['public', 'private']) {
    const gsiParams = {
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
      ExpressionAttributeValues: {
        ':visibility': visibility,
        ':username': viewerUsername
      },
      Limit: 1
    };
    
    try {
      const gsiResult = await dynamodb.query(gsiParams).promise();
      if (gsiResult.Items && gsiResult.Items.length > 0) {
        const foundUser = gsiResult.Items.find(item => {
          if (!item.username) return false;
          return normalizeUsernameForComparison(item.username) === viewerNormalized;
        });
        if (foundUser) {
          viewerEmail = foundUser.email || (foundUser.PK?.replace('USER#', '') || null);
          if (viewerEmail) {
            console.log(`✅ Found viewer email: ${viewerEmail}`);
            break;
          }
        }
      }
    } catch (error) {
      // Continue
    }
  }
  
  if (!viewerEmail) {
    console.log('❌ Could not resolve viewer email');
    return;
  }
  
  // Step 3: Check existing ADDED_USERNAME entry
  console.log(`\n3️⃣ CHECKING EXISTING ADDED_USERNAME ENTRY:`);
  console.log('-'.repeat(80));
  
  const existingParams = {
    TableName: table,
    Key: {
      PK: `USER#${viewerEmail}`,
      SK: `ADDED_USERNAME#${ownerEmail}#private`
    }
  };
  
  const existing = await dynamodb.get(existingParams).promise();
  
  if (existing.Item) {
    console.log('✅ ADDED_USERNAME entry exists:');
    console.log(JSON.stringify(existing.Item, null, 2));
    console.log(`\n   Status: ${existing.Item.status}`);
    console.log(`   Entry already exists: ${existing.Item.status === 'active'}`);
  } else {
    console.log('ℹ️ No existing ADDED_USERNAME entry');
  }
  
  // Step 4: Check notifications for viewer
  console.log(`\n4️⃣ CHECKING NOTIFICATIONS FOR VIEWER (${viewerEmail}):`);
  console.log('-'.repeat(80));
  
  const notificationParams = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${viewerEmail}`,
      ':skPrefix': 'NOTIFICATION#'
    },
    Limit: 100,
    ScanIndexForward: false
  };
  
  const notificationResult = await dynamodb.query(notificationParams).promise();
  const allNotifications = notificationResult.Items || [];
  const privateAccessNotifications = allNotifications.filter(n => 
    n.type === 'private_access_granted' && 
    n.metadata?.ownerEmail === ownerEmail
  );
  
  console.log(`Total notifications: ${allNotifications.length}`);
  console.log(`Private access notifications from ${ownerUsername}: ${privateAccessNotifications.length}`);
  
  if (privateAccessNotifications.length > 0) {
    console.log('\nRecent private access notifications:');
    privateAccessNotifications.slice(0, 5).forEach((notif, idx) => {
      console.log(`\n   [${idx + 1}] ${notif.message}`);
      console.log(`       PK: ${notif.PK}`);
      console.log(`       SK: ${notif.SK}`);
      console.log(`       Created: ${notif.createdAt}`);
      console.log(`       IsRead: ${notif.isRead}`);
      console.log(`       Owner: ${notif.metadata?.ownerUsername || 'N/A'}`);
    });
  } else {
    console.log('\n⚠️ No private_access_granted notifications found!');
    console.log('   This is the problem - notifications are not being created.');
  }
  
  // Step 5: Simulate what should happen
  console.log(`\n5️⃣ SIMULATING NOTIFICATION CREATION:`);
  console.log('-'.repeat(80));
  
  const notificationId = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const notificationItem = {
    PK: `USER#${viewerEmail}`,
    SK: `NOTIFICATION#${notificationId}`,
    type: 'private_access_granted',
    title: 'Private Access Granted',
    message: `You were added to ${ownerUsername}'s private timeline`,
    metadata: {
      ownerEmail: ownerEmail,
      ownerUsername: ownerUsername,
      viewerEmail: viewerEmail,
      viewerUsername: viewerUsername
    },
    isRead: false,
    createdAt: new Date().toISOString()
  };
  
  console.log('Would create notification:');
  console.log(JSON.stringify(notificationItem, null, 2));
  console.log(`\n   Query key: PK=USER#${viewerEmail}, SK begins_with NOTIFICATION#`);
  console.log(`   This notification should be queryable by: get-notifications with userEmail=${viewerEmail}`);
}

testAddNotificationFlow()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
