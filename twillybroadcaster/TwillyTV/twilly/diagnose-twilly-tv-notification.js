const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function diagnoseTwillyTVNotification() {
  console.log('🔍 DIAGNOSING TWILLY TV NOTIFICATION ISSUE\n');
  console.log('='.repeat(80));
  
  const targetUsername = 'Twilly TV';
  
  // Step 1: Find all PROFILE entries with username "Twilly TV"
  console.log('\n1️⃣ FINDING ALL PROFILE ENTRIES FOR "Twilly TV":');
  console.log('-'.repeat(80));
  
  const profileScanParams = {
    TableName: table,
    FilterExpression: 'SK = :sk',
    ExpressionAttributeValues: {
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
  
  // Normalize function (same as in add-private-viewer)
  const normalizeUsernameForComparison = (username) => {
    if (!username) return '';
    return username.replace(/\s+/g, '').toLowerCase();
  };
  
  const normalizedTarget = normalizeUsernameForComparison(targetUsername);
  const twillyTVProfiles = allProfiles.filter(profile => {
    if (!profile.username) return false;
    return normalizeUsernameForComparison(profile.username) === normalizedTarget;
  });
  
  console.log(`Found ${twillyTVProfiles.length} PROFILE entry/entries for "Twilly TV":`);
  twillyTVProfiles.forEach((profile, idx) => {
    const email = profile.PK.replace('USER#', '');
    console.log(`\n   [${idx + 1}] Email: ${email}`);
    console.log(`       PK: ${profile.PK}`);
    console.log(`       SK: ${profile.SK}`);
    console.log(`       Username: "${profile.username}"`);
    console.log(`       UsernameVisibility: ${profile.usernameVisibility || 'N/A'}`);
  });
  
  if (twillyTVProfiles.length === 0) {
    console.log('\n❌ No PROFILE found for "Twilly TV"!');
    return;
  }
  
  // Step 2: Check GSI lookup (how add-private-viewer would resolve it)
  console.log('\n\n2️⃣ TESTING GSI LOOKUP (How add-private-viewer resolves "Twilly TV"):');
  console.log('-'.repeat(80));
  
  const usernameVariations = [
    targetUsername,
    targetUsername.toLowerCase(),
    targetUsername.charAt(0).toUpperCase() + targetUsername.slice(1).toLowerCase(),
    targetUsername.replace(/\s+/g, ''),
    targetUsername.replace(/\s+/g, ' '),
    targetUsername.replace(/\s+/g, '_')
  ];
  
  let resolvedEmail = null;
  
  for (const variation of usernameVariations) {
    for (const visibility of ['public', 'private']) {
      const gsiParams = {
        TableName: table,
        IndexName: 'UsernameSearchIndex',
        KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
        ExpressionAttributeValues: {
          ':visibility': visibility,
          ':username': variation
        },
        Limit: 1
      };
      
      try {
        const gsiResult = await dynamodb.query(gsiParams).promise();
        if (gsiResult.Items && gsiResult.Items.length > 0) {
          const foundUser = gsiResult.Items.find(item => {
            if (!item.username) return false;
            return normalizeUsernameForComparison(item.username) === normalizedTarget;
          });
          if (foundUser && foundUser.email) {
            resolvedEmail = foundUser.email.toLowerCase();
            console.log(`✅ GSI lookup found: "${foundUser.username}" → ${resolvedEmail}`);
            console.log(`   Variation used: "${variation}"`);
            console.log(`   Visibility: ${visibility}`);
            break;
          }
        }
      } catch (error) {
        // Continue
      }
    }
    if (resolvedEmail) break;
  }
  
  if (!resolvedEmail) {
    console.log('⚠️ GSI lookup failed - trying scan...');
    // Try scan
    for (const visibility of ['public', 'private']) {
      const scanParams = {
        TableName: table,
        IndexName: 'UsernameSearchIndex',
        KeyConditionExpression: 'usernameVisibility = :visibility',
        ExpressionAttributeValues: {
          ':visibility': visibility
        }
      };
      
      let lastKey = null;
      do {
        if (lastKey) scanParams.ExclusiveStartKey = lastKey;
        try {
          const scanResult = await dynamodb.query(scanParams).promise();
          const foundUser = scanResult.Items.find(item => {
            if (!item.username) return false;
            return normalizeUsernameForComparison(item.username) === normalizedTarget;
          });
          if (foundUser && foundUser.email) {
            resolvedEmail = foundUser.email.toLowerCase();
            console.log(`✅ GSI scan found: "${foundUser.username}" → ${resolvedEmail}`);
            break;
          }
          lastKey = scanResult.LastEvaluatedKey;
        } catch (error) {
          break;
        }
      } while (lastKey && !resolvedEmail);
      if (resolvedEmail) break;
    }
  }
  
  if (!resolvedEmail) {
    console.log('❌ Could not resolve email via GSI - using first PROFILE email');
    resolvedEmail = twillyTVProfiles[0].PK.replace('USER#', '').toLowerCase();
  }
  
  console.log(`\n📧 Resolved email for notification creation: ${resolvedEmail}`);
  
  // Step 3: Check notifications for the resolved email
  console.log('\n\n3️⃣ CHECKING NOTIFICATIONS FOR RESOLVED EMAIL:');
  console.log('-'.repeat(80));
  console.log(`Querying: PK=USER#${resolvedEmail}, SK begins_with NOTIFICATION#`);
  
  const notificationParams = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${resolvedEmail}`,
      ':skPrefix': 'NOTIFICATION#'
    },
    Limit: 100,
    ScanIndexForward: false
  };
  
  const notificationResult = await dynamodb.query(notificationParams).promise();
  const allNotifications = notificationResult.Items || [];
  const privateAccessNotifications = allNotifications.filter(n => n.type === 'private_access_granted');
  
  console.log(`\nFound ${allNotifications.length} total notifications`);
  console.log(`Found ${privateAccessNotifications.length} private_access_granted notifications`);
  
  if (privateAccessNotifications.length > 0) {
    console.log('\nPrivate access notifications:');
    privateAccessNotifications.forEach((notif, idx) => {
      console.log(`\n   [${idx + 1}] ${notif.message}`);
      console.log(`       PK: ${notif.PK}`);
      console.log(`       SK: ${notif.SK}`);
      console.log(`       Type: ${notif.type}`);
      console.log(`       IsRead: ${notif.isRead}`);
      console.log(`       Created: ${notif.createdAt}`);
      console.log(`       Owner: ${notif.metadata?.ownerUsername || 'N/A'} (${notif.metadata?.ownerEmail || 'N/A'})`);
    });
  } else {
    console.log('\n⚠️ No private_access_granted notifications found!');
  }
  
  // Step 4: Check all PROFILE emails for notifications
  console.log('\n\n4️⃣ CHECKING NOTIFICATIONS FOR ALL TWILLY TV PROFILE EMAILS:');
  console.log('-'.repeat(80));
  
  for (const profile of twillyTVProfiles) {
    const email = profile.PK.replace('USER#', '').toLowerCase();
    console.log(`\n📧 Checking email: ${email}`);
    
    const notifParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':skPrefix': 'NOTIFICATION#'
      },
      Limit: 100,
      ScanIndexForward: false
    };
    
    try {
      const notifResult = await dynamodb.query(notifParams).promise();
      const notifs = notifResult.Items || [];
      const privateNotifs = notifs.filter(n => n.type === 'private_access_granted');
      
      console.log(`   Total notifications: ${notifs.length}`);
      console.log(`   Private access notifications: ${privateNotifs.length}`);
      
      if (privateNotifs.length > 0) {
        privateNotifs.forEach((notif, idx) => {
          console.log(`   [${idx + 1}] ${notif.message} (read: ${notif.isRead})`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Error querying: ${error.message}`);
    }
  }
  
  // Step 5: Check recent ADDED_USERNAME entries to see what email was used
  console.log('\n\n5️⃣ CHECKING RECENT ADDED_USERNAME ENTRIES FOR TWILLY TV:');
  console.log('-'.repeat(80));
  
  for (const profile of twillyTVProfiles) {
    const email = profile.PK.replace('USER#', '').toLowerCase();
    console.log(`\n📧 Checking ADDED_USERNAME entries for: ${email}`);
    
    const addedParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':skPrefix': 'ADDED_USERNAME#'
      },
      Limit: 20,
      ScanIndexForward: false
    };
    
    try {
      const addedResult = await dynamodb.query(addedParams).promise();
      const addedEntries = addedResult.Items || [];
      const privateEntries = addedEntries.filter(e => e.streamerVisibility === 'private');
      
      console.log(`   Total ADDED_USERNAME entries: ${addedEntries.length}`);
      console.log(`   Private entries: ${privateEntries.length}`);
      
      if (privateEntries.length > 0) {
        console.log('\n   Recent private entries:');
        privateEntries.slice(0, 5).forEach((entry, idx) => {
          console.log(`   [${idx + 1}] Added by: ${entry.streamerUsername} (${entry.streamerEmail})`);
          console.log(`       SK: ${entry.SK}`);
          console.log(`       Added at: ${entry.addedAt || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Error querying: ${error.message}`);
    }
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('✅ DIAGNOSIS COMPLETE');
  console.log('\nSUMMARY:');
  console.log(`- Found ${twillyTVProfiles.length} PROFILE entry/entries for "Twilly TV"`);
  console.log(`- GSI lookup resolves to: ${resolvedEmail || 'FAILED'}`);
  if (resolvedEmail) {
    const notifs = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${resolvedEmail}`,
        ':skPrefix': 'NOTIFICATION#'
      },
      Limit: 100
    }).promise();
    const privateNotifs = (notifs.Items || []).filter(n => n.type === 'private_access_granted');
    console.log(`- Notifications for resolved email: ${privateNotifs.length} private_access_granted`);
  }
}

diagnoseTwillyTVNotification()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
