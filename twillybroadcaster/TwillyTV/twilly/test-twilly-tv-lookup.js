import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function testTwillyTVLookup() {
  const requestedUsername = 'Twilly TV';
  const requestedUsernameLower = requestedUsername.toLowerCase();
  
  console.log(`🔍 Testing username lookup for: "${requestedUsername}"\n`);
  console.log('='.repeat(60));

  try {
    // Step 1: Try GSI lookup
    console.log('\n1️⃣ GSI LOOKUP (UsernameSearchIndex):');
    console.log('-'.repeat(60));
    let requestedUser = null;
    
    try {
      const gsiParams = {
        TableName: table,
        IndexName: 'UsernameSearchIndex',
        KeyConditionExpression: 'usernameVisibility = :visibility AND username = :username',
        ExpressionAttributeValues: {
          ':visibility': 'public',
          ':username': requestedUsername
        }
      };
      
      const gsiResult = await dynamodb.query(gsiParams).promise();
      if (gsiResult.Items && gsiResult.Items.length > 0) {
        requestedUser = gsiResult.Items[0];
        console.log(`✅ Found via GSI: ${requestedUser.username}`);
        console.log(`   PK: ${requestedUser.PK}`);
        console.log(`   SK: ${requestedUser.SK}`);
        console.log(`   Visibility: ${requestedUser.usernameVisibility}`);
      } else {
        console.log(`❌ Not found in GSI (public)`);
      }
    } catch (gsiError) {
      console.log(`⚠️  GSI lookup failed: ${gsiError.message}`);
    }

    // Step 2: Try USER record lookup
    if (!requestedUser) {
      console.log('\n2️⃣ USER RECORD LOOKUP (PK=USER, SK=username):');
      console.log('-'.repeat(60));
      try {
        const userParams = {
          TableName: table,
          Key: {
            PK: 'USER',
            SK: requestedUsername
          }
        };
        const userResult = await dynamodb.get(userParams).promise();
        if (userResult.Item) {
          requestedUser = userResult.Item;
          console.log(`✅ Found in USER record: ${requestedUser.username}`);
          console.log(`   PK: ${requestedUser.PK}`);
          console.log(`   SK: ${requestedUser.SK}`);
          console.log(`   Email: ${requestedUser.email || 'N/A'}`);
        } else {
          console.log(`❌ Not found in USER record`);
        }
      } catch (userError) {
        console.log(`⚠️  USER record lookup failed: ${userError.message}`);
      }
    }

    // Step 3: Try PROFILE scan (this is what the backend does)
    if (!requestedUser) {
      console.log('\n3️⃣ PROFILE SCAN (PK=USER#email, SK=PROFILE):');
      console.log('-'.repeat(60));
      console.log('   Scanning all PROFILE items...');
      
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

      console.log(`   Scanned ${allProfiles.length} PROFILE items`);

      // Case-insensitive search for exact username match
      requestedUser = allProfiles.find(profile => {
        if (!profile.username) return false;
        return profile.username.toLowerCase() === requestedUsernameLower;
      });
      
      if (requestedUser) {
        console.log(`✅ Found via PROFILE scan: ${requestedUser.username}`);
        console.log(`   PK: ${requestedUser.PK}`);
        console.log(`   SK: ${requestedUser.SK}`);
        console.log(`   Username: ${requestedUser.username}`);
        console.log(`   Visibility: ${requestedUser.usernameVisibility || 'N/A'}`);
      } else {
        console.log(`❌ Not found in PROFILE scan`);
        console.log(`\n   Checking for similar usernames...`);
        const similar = allProfiles.filter(p => 
          p.username && p.username.toLowerCase().includes('twilly')
        );
        if (similar.length > 0) {
          console.log(`   Found ${similar.length} similar usernames:`);
          similar.forEach(p => {
            console.log(`      - "${p.username}" (PK: ${p.PK})`);
          });
        }
      }
    }

    // Step 4: Extract email
    if (requestedUser) {
      console.log('\n4️⃣ EMAIL EXTRACTION:');
      console.log('-'.repeat(60));
      let requestedUserEmail = requestedUser.email || requestedUser.userEmail;
      if (requestedUser.PK && requestedUser.PK.startsWith('USER#')) {
        requestedUserEmail = requestedUserEmail || requestedUser.PK.replace('USER#', '');
      }
      
      console.log(`   Email from .email field: ${requestedUser.email || 'N/A'}`);
      console.log(`   Email from .userEmail field: ${requestedUser.userEmail || 'N/A'}`);
      console.log(`   Email extracted from PK: ${requestedUser.PK?.replace('USER#', '') || 'N/A'}`);
      console.log(`   Final email: ${requestedUserEmail || '❌ COULD NOT EXTRACT'}`);
      
      if (!requestedUserEmail) {
        console.log(`\n❌ CRITICAL: Could not extract email for username: "${requestedUsername}"`);
      } else {
        console.log(`\n✅ Email extraction successful: ${requestedUserEmail}`);
      }
    } else {
      console.log(`\n❌ CRITICAL: Username "${requestedUsername}" not found in database!`);
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error);
  }
}

testTwillyTVLookup();
