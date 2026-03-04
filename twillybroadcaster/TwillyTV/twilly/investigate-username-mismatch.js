import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function investigateUsernameMismatch() {
  const email = 'dehyubuilds@gmail.com';
  console.log(`🔍 Investigating username mismatch for: ${email}\n`);
  console.log('='.repeat(60));

  try {
    // Find userId first
    let userId = null;
    const userScanParams = {
      TableName: table,
      FilterExpression: 'PK = :pk AND email = :email',
      ExpressionAttributeValues: {
        ':pk': 'USER',
        ':email': email
      },
      Limit: 1
    };
    const userScanResult = await dynamodb.scan(userScanParams).promise();
    if (userScanResult.Items && userScanResult.Items.length > 0) {
      userId = userScanResult.Items[0].SK || userScanResult.Items[0].userId;
      console.log(`✅ Found userId: ${userId}\n`);
    }

    // Check all locations where username might be stored
    console.log('1️⃣ USER RECORD (PK=USER, SK=userId) - Source of Truth:');
    console.log('-'.repeat(60));
    if (userId) {
      const userParams = {
        TableName: table,
        Key: {
          PK: 'USER',
          SK: userId
        }
      };
      const userResult = await dynamodb.get(userParams).promise();
      if (userResult.Item) {
        console.log(`   Username: ${userResult.Item.username || 'N/A'}`);
        console.log(`   Email: ${userResult.Item.email || 'N/A'}`);
        console.log(`   Updated At: ${userResult.Item.updatedAt || 'N/A'}`);
        console.log(`   Created At: ${userResult.Item.createdAt || 'N/A'}`);
      } else {
        console.log(`   ❌ Not found`);
      }
    }

    console.log('\n2️⃣ PROFILE RECORD (PK=USER#email, SK=PROFILE):');
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
      console.log(`   Username: ${profileResult.Item.username || 'N/A'}`);
      console.log(`   Private Username: ${profileResult.Item.privateUsername || 'N/A'}`);
      console.log(`   Email: ${profileResult.Item.email || 'N/A'}`);
      console.log(`   Updated At: ${profileResult.Item.updatedAt || 'N/A'}`);
      console.log(`   Created At: ${profileResult.Item.createdAt || 'N/A'}`);
    } else {
      console.log(`   ❌ Not found`);
    }

    // Check if there's a USER#userId/PROFILE record
    console.log('\n3️⃣ PROFILE RECORD (PK=USER#userId, SK=PROFILE):');
    console.log('-'.repeat(60));
    if (userId) {
      const profile2Params = {
        TableName: table,
        Key: {
          PK: `USER#${userId}`,
          SK: 'PROFILE'
        }
      };
      const profile2Result = await dynamodb.get(profile2Params).promise();
      if (profile2Result.Item) {
        console.log(`   Username: ${profile2Result.Item.username || 'N/A'}`);
        console.log(`   Email: ${profile2Result.Item.email || 'N/A'}`);
        console.log(`   Updated At: ${profile2Result.Item.updatedAt || 'N/A'}`);
      } else {
        console.log(`   ❌ Not found`);
      }
    }

    // Check GSI
    console.log('\n4️⃣ GSI RECORD (UsernameSearchIndex):');
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
        for (const item of gsiResult.Items) {
          console.log(`   Username: ${item.username || 'N/A'}`);
          console.log(`   Visibility: ${item.usernameVisibility || 'N/A'}`);
          console.log(`   PK: ${item.PK}`);
          console.log(`   SK: ${item.SK}`);
        }
      } else {
        console.log(`   ❌ Not found`);
      }
    } catch (gsiError) {
      console.log(`   ⚠️  GSI lookup failed: ${gsiError.message}`);
    }

    // Summary
    console.log('\n📋 SUMMARY:');
    console.log('='.repeat(60));
    const userRecord = userScanResult.Items?.[0];
    const profileRecord = profileResult.Item;
    
    if (userRecord && profileRecord) {
      const userUsername = userRecord.username;
      const profileUsername = profileRecord.username;
      
      if (userUsername !== profileUsername) {
        console.log(`⚠️  MISMATCH DETECTED!`);
        console.log(`   USER record: "${userUsername}"`);
        console.log(`   PROFILE record: "${profileUsername}"`);
        console.log(`\n   The USER record (PK='USER', SK=userId) is the source of truth.`);
        console.log(`   The PROFILE record should be synced to match it.`);
        
        // Check timestamps to see which is more recent
        const userUpdated = userRecord.updatedAt || userRecord.createdAt;
        const profileUpdated = profileRecord.updatedAt || profileRecord.createdAt;
        
        if (userUpdated && profileUpdated) {
          const userDate = new Date(userUpdated);
          const profileDate = new Date(profileUpdated);
          console.log(`\n   Timestamps:`);
          console.log(`   USER record updated: ${userDate.toLocaleString()}`);
          console.log(`   PROFILE record updated: ${profileDate.toLocaleString()}`);
          if (userDate > profileDate) {
            console.log(`   ✅ USER record is more recent`);
          } else if (profileDate > userDate) {
            console.log(`   ⚠️  PROFILE record is more recent (but USER is still source of truth)`);
          } else {
            console.log(`   ⚠️  Timestamps are the same or missing`);
          }
        }
      } else {
        console.log(`✅ Usernames match: "${userUsername}"`);
      }
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error);
  }
}

investigateUsernameMismatch();
