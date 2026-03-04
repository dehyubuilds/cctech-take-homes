/**
 * Diagnostic script to trace notification flow for "dehyuusername"
 * 
 * This script checks:
 * 1. What email "dehyuusername" uses when querying notifications
 * 2. What email was used when creating notifications for "dehyuusername"
 * 3. Whether there's a mismatch causing notifications to not appear
 */

const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function diagnose() {
  console.log('\n🔍 ========== DIAGNOSING DEHYUUSERNAME NOTIFICATION ISSUE ==========\n');

  // Step 1: Find all PROFILE entries for "dehyuusername"
  console.log('📋 STEP 1: Finding all PROFILE entries for "dehyuusername"...');
  const scanParams = {
    TableName: table,
    FilterExpression: 'SK = :sk AND username = :username',
    ExpressionAttributeValues: {
      ':sk': 'PROFILE',
      ':username': 'dehyuusername'
    }
  };

  const scanResult = await dynamodb.scan(scanParams).promise();
  const profiles = scanResult.Items || [];

  console.log(`   Found ${profiles.length} PROFILE entries:`);
  profiles.forEach((profile, idx) => {
    const pkEmail = profile.PK?.replace('USER#', '');
    console.log(`   [${idx + 1}] PK: ${profile.PK}`);
    console.log(`       Email field: ${profile.email || 'N/A'}`);
    console.log(`       Email from PK: ${pkEmail}`);
    console.log(`       Username: ${profile.username}`);
    console.log(`       UsernameVisibility: ${profile.usernameVisibility || 'N/A'}`);
    console.log(`       Is UUID: ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pkEmail)}`);
    console.log(`       Has @: ${pkEmail && pkEmail.includes('@')}`);
    console.log('');
  });

  // Step 2: Check notifications for each email
  console.log('📬 STEP 2: Checking notifications for each email...');
  for (const profile of profiles) {
    const pkEmail = profile.PK?.replace('USER#', '');
    const emailToCheck = profile.email || pkEmail;
    
    if (!emailToCheck) continue;

    console.log(`\n   Checking notifications for: ${emailToCheck} (from PK: ${profile.PK})`);
    
    const notificationParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${emailToCheck.toLowerCase()}`,
        ':skPrefix': 'NOTIFICATION#'
      },
      Limit: 100
    };

    try {
      const notifResult = await dynamodb.query(notificationParams).promise();
      const notifications = notifResult.Items || [];
      const privateAccessNotifs = notifications.filter(n => n.type === 'private_access_granted');
      
      console.log(`      Total notifications: ${notifications.length}`);
      console.log(`      Private access notifications: ${privateAccessNotifs.length}`);
      
      if (privateAccessNotifs.length > 0) {
        console.log(`      Private access notifications:`);
        privateAccessNotifs.forEach((notif, idx) => {
          console.log(`         [${idx + 1}] ${notif.message}`);
          console.log(`             Created: ${notif.createdAt}`);
          console.log(`             Owner: ${notif.metadata?.ownerUsername || 'N/A'} (${notif.metadata?.ownerEmail || 'N/A'})`);
          console.log(`             Viewer: ${notif.metadata?.viewerUsername || 'N/A'} (${notif.metadata?.viewerEmail || 'N/A'})`);
        });
      }
    } catch (error) {
      console.log(`      ❌ Error querying notifications: ${error.message}`);
    }
  }

  // Step 3: Check ADDED_USERNAME entries to see what email was used
  console.log('\n🔒 STEP 3: Checking ADDED_USERNAME entries for "dehyuusername"...');
  for (const profile of profiles) {
    const pkEmail = profile.PK?.replace('USER#', '');
    const emailToCheck = profile.email || pkEmail;
    
    if (!emailToCheck) continue;

    console.log(`\n   Checking ADDED_USERNAME entries for: ${emailToCheck} (from PK: ${profile.PK})`);
    
    const addedParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${emailToCheck.toLowerCase()}`,
        ':skPrefix': 'ADDED_USERNAME#'
      }
    };

    try {
      const addedResult = await dynamodb.query(addedParams).promise();
      const addedEntries = addedResult.Items || [];
      const privateEntries = addedEntries.filter(e => e.SK && e.SK.includes('#private'));
      
      console.log(`      Total ADDED_USERNAME entries: ${addedEntries.length}`);
      console.log(`      Private entries: ${privateEntries.length}`);
      
      if (privateEntries.length > 0) {
        console.log(`      Private ADDED_USERNAME entries:`);
        privateEntries.forEach((entry, idx) => {
          console.log(`         [${idx + 1}] SK: ${entry.SK}`);
          console.log(`             Status: ${entry.status || 'N/A'}`);
          console.log(`             Added at: ${entry.addedAt || 'N/A'}`);
          console.log(`             Streamer: ${entry.streamerUsername || 'N/A'} (${entry.streamerEmail || 'N/A'})`);
        });
      }
    } catch (error) {
      console.log(`      ❌ Error querying ADDED_USERNAME entries: ${error.message}`);
    }
  }

  // Step 4: Check what email "Twilly TV" resolved to when adding "dehyuusername"
  console.log('\n🔍 STEP 4: Simulating email resolution for "dehyuusername" (as viewer)...');
  
  // Simulate the resolveEmailFromUsername logic
  const viewerUsername = 'dehyuusername';
  const normalizeUsernameForComparison = (username) => {
    if (!username) return '';
    return username.replace(/\s+/g, '').toLowerCase();
  };
  
  const normalizedSearch = normalizeUsernameForComparison(viewerUsername);
  console.log(`   Normalized search: "${normalizedSearch}"`);
  
  // Try GSI queries
  for (const visibility of ['public', 'private']) {
    const gsiParams = {
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
      ExpressionAttributeValues: {
        ':visibility': visibility,
        ':username': viewerUsername
      },
      Limit: 10
    };
    
    try {
      const gsiResult = await dynamodb.query(gsiParams).promise();
      if (gsiResult.Items && gsiResult.Items.length > 0) {
        console.log(`   GSI query (${visibility}): Found ${gsiResult.Items.length} items`);
        
        const matchingUsers = gsiResult.Items.filter(item => {
          if (!item.username) return false;
          const itemNormalized = normalizeUsernameForComparison(item.username);
          return itemNormalized === normalizedSearch;
        });
        
        console.log(`   Matching users: ${matchingUsers.length}`);
        
        matchingUsers.forEach((item, idx) => {
          let email = item.email;
          if (!email && item.PK && item.PK.startsWith('USER#')) {
            email = item.PK.replace('USER#', '');
          }
          
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(email);
          
          console.log(`      [${idx + 1}] Username: ${item.username}`);
          console.log(`          PK: ${item.PK}`);
          console.log(`          Email field: ${item.email || 'N/A'}`);
          console.log(`          Email from PK: ${email}`);
          console.log(`          Is UUID: ${isUUID}`);
          console.log(`          Has @: ${email && email.includes('@')}`);
          console.log(`          Priority: ${item.email ? 'HIGH (has email field)' : (email && email.includes('@') ? 'MEDIUM (email in PK)' : 'LOW (UUID)')}`);
        });
      }
    } catch (error) {
      console.log(`   ❌ GSI query failed for ${visibility}: ${error.message}`);
    }
  }

  console.log('\n✅ ========== DIAGNOSIS COMPLETE ==========\n');
}

diagnose().catch(console.error);
