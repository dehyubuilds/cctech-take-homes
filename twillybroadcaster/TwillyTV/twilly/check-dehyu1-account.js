import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkAccount() {
  const userEmail = 'dehyu1@umbc.edu';
  
  console.log(`🔍 Checking account: ${userEmail}\n`);
  console.log('='.repeat(60));

  try {
    // 1. Get current username from PROFILE
    console.log('\n1️⃣ CURRENT USERNAME:');
    const profileParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: 'PROFILE'
      }
    };
    const profileResult = await dynamodb.get(profileParams).promise();
    if (profileResult.Item) {
      console.log(`   Username: ${profileResult.Item.username || 'NOT SET'}`);
      console.log(`   Private Username: ${profileResult.Item.privateUsername || 'NOT SET'}`);
      console.log(`   Visibility: ${profileResult.Item.usernameVisibility || 'NOT SET'}`);
    } else {
      console.log('   ⚠️  No PROFILE found');
    }

    // Also check USER record (PK='USER', SK=userId)
    console.log('\n   Checking USER record (PK=USER, SK=userId)...');
    const userScanParams = {
      TableName: table,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': userEmail
      }
    };
    const userScanResult = await dynamodb.scan(userScanParams).promise();
    if (userScanResult.Items && userScanResult.Items.length > 0) {
      for (const item of userScanResult.Items) {
        if (item.PK === 'USER' && item.username) {
          console.log(`   Username from USER record: ${item.username}`);
        }
      }
    }

    // 2. Get ALL added usernames for this user
    console.log('\n2️⃣ ALL ADDED_USERNAME ENTRIES:');
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userEmail}`,
        ':skPrefix': 'ADDED_USERNAME#'
      }
    };

    const result = await dynamodb.query(queryParams).promise();
    const addedUsernames = result.Items || [];

    console.log(`   Total entries found: ${addedUsernames.length}\n`);

    if (addedUsernames.length === 0) {
      console.log('   ✅ No added username entries found');
    } else {
      for (const entry of addedUsernames) {
        const streamerEmail = entry.streamerEmail || 'N/A';
        const streamerUsername = entry.streamerUsername || 'N/A';
        const isSelfAdded = streamerEmail.toLowerCase() === userEmail.toLowerCase();
        
        console.log(`   Entry:`);
        console.log(`      SK: ${entry.SK}`);
        console.log(`      Streamer Username: ${streamerUsername}`);
        console.log(`      Streamer Email: ${streamerEmail}`);
        console.log(`      Visibility: ${entry.streamerVisibility || 'N/A'}`);
        console.log(`      Status: ${entry.status || 'N/A'}`);
        console.log(`      Self-Added: ${isSelfAdded ? 'YES ⚠️' : 'NO'}`);
        
        // Check if this is a robday entry
        if (streamerUsername.toLowerCase().includes('robday') || streamerUsername.toLowerCase().includes('robertday')) {
          console.log(`      ⚠️⚠️⚠️  THIS IS A ROBDAY ENTRY! ⚠️⚠️⚠️`);
        }
        console.log('');
      }
    }

    // 3. Check for robday specifically
    console.log('\n3️⃣ ROBDAY ENTRIES:');
    const robdayEntries = addedUsernames.filter(entry => {
      const username = (entry.streamerUsername || '').toLowerCase();
      return username.includes('robday') || username.includes('robertday');
    });

    if (robdayEntries.length === 0) {
      console.log('   ✅ No robday entries found in ADDED_USERNAME');
    } else {
      console.log(`   ⚠️  Found ${robdayEntries.length} robday entry/entries:`);
      for (const entry of robdayEntries) {
        console.log(`      - ${entry.streamerUsername} (Email: ${entry.streamerEmail}, SK: ${entry.SK})`);
        const isSelfAdded = (entry.streamerEmail || '').toLowerCase() === userEmail.toLowerCase();
        console.log(`        Self-Added: ${isSelfAdded ? 'YES - SHOULD BE DELETED!' : 'NO'}`);
      }
    }

    // 4. Check what email robday might be associated with
    console.log('\n4️⃣ CHECKING ROBDAY USER PROFILE:');
    const robdaySearchParams = {
      TableName: table,
      FilterExpression: 'contains(username, :username) OR contains(username, :username2)',
      ExpressionAttributeValues: {
        ':username': 'robday',
        ':username2': 'RobertDay'
      }
    };
    const robdaySearchResult = await dynamodb.scan(robdaySearchParams).promise();
    if (robdaySearchResult.Items && robdaySearchResult.Items.length > 0) {
      for (const item of robdaySearchResult.Items) {
        if (item.username && (item.username.toLowerCase().includes('robday') || item.username.toLowerCase().includes('robertday'))) {
          console.log(`   Found robday user:`);
          console.log(`      PK: ${item.PK}`);
          console.log(`      SK: ${item.SK}`);
          console.log(`      Username: ${item.username}`);
          console.log(`      Email: ${item.email || 'N/A'}`);
          
          // Check if this email matches the user's email
          if (item.email && item.email.toLowerCase() === userEmail.toLowerCase()) {
            console.log(`      ⚠️⚠️⚠️  THIS EMAIL MATCHES! This is the same user! ⚠️⚠️⚠️`);
          }
        }
      }
    } else {
      console.log('   No robday user profile found');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Check completed\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkAccount()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
