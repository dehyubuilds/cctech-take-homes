import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findAllUsernameLocations() {
  const email = 'dehyubuilds@gmail.com';
  console.log(`🔍 Finding ALL username locations for: ${email}\n`);
  console.log('='.repeat(60));

  try {
    // Scan ALL USER records to find ones with this email
    console.log('\n1️⃣ SCANNING ALL USER RECORDS (PK=USER):');
    console.log('-'.repeat(60));
    const userScanParams = {
      TableName: table,
      FilterExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'USER'
      }
    };

    let allUserRecords = [];
    let lastEvaluatedKey = null;
    
    do {
      const paginatedParams = {
        ...userScanParams,
        ExclusiveStartKey: lastEvaluatedKey
      };
      const result = await dynamodb.scan(paginatedParams).promise();
      allUserRecords = allUserRecords.concat(result.Items || []);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`   Found ${allUserRecords.length} total USER records`);
    
    // Filter for records with matching email
    const matchingRecords = allUserRecords.filter(record => 
      record.email === email || record.userEmail === email
    );
    
    console.log(`   Found ${matchingRecords.length} USER record(s) with email ${email}:`);
    for (const record of matchingRecords) {
      console.log(`\n   Record:`);
      console.log(`      SK (userId): ${record.SK}`);
      console.log(`      Username: ${record.username || 'N/A'}`);
      console.log(`      Email: ${record.email || record.userEmail || 'N/A'}`);
      console.log(`      Updated At: ${record.updatedAt || 'N/A'}`);
      console.log(`      Created At: ${record.createdAt || 'N/A'}`);
    }

    // Check PROFILE
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
      console.log(`   Updated At: ${profileResult.Item.updatedAt || 'N/A'}`);
      console.log(`   Created At: ${profileResult.Item.createdAt || 'N/A'}`);
    } else {
      console.log(`   ❌ Not found`);
    }

    // Summary
    console.log('\n📋 SUMMARY:');
    console.log('='.repeat(60));
    
    if (matchingRecords.length > 0) {
      const userRecord = matchingRecords[0];
      const profileRecord = profileResult.Item;
      
      console.log(`\n   USER Record (Source of Truth):`);
      console.log(`      Username: "${userRecord.username || 'N/A'}"`);
      console.log(`      Updated: ${userRecord.updatedAt || 'N/A'}`);
      
      if (profileRecord) {
        console.log(`\n   PROFILE Record:`);
        console.log(`      Username: "${profileRecord.username || 'N/A'}"`);
        console.log(`      Updated: ${profileRecord.updatedAt || 'N/A'}`);
        
        if (userRecord.username !== profileRecord.username) {
          console.log(`\n   ⚠️  MISMATCH!`);
          console.log(`      USER record has: "${userRecord.username}"`);
          console.log(`      PROFILE record has: "${profileRecord.username}"`);
          
          // Compare timestamps
          if (userRecord.updatedAt && profileRecord.updatedAt) {
            const userDate = new Date(userRecord.updatedAt);
            const profileDate = new Date(profileRecord.updatedAt);
            console.log(`\n   Timestamps:`);
            console.log(`      USER: ${userDate.toLocaleString()}`);
            console.log(`      PROFILE: ${profileDate.toLocaleString()}`);
            
            if (userDate > profileDate) {
              console.log(`\n   ✅ USER record is MORE RECENT (${Math.round((userDate - profileDate) / 1000 / 60)} minutes newer)`);
              console.log(`      This is the source of truth and should be used.`);
            } else {
              console.log(`\n   ⚠️  PROFILE record is MORE RECENT (${Math.round((profileDate - userDate) / 1000 / 60)} minutes newer)`);
              console.log(`      However, USER record is still the source of truth per system design.`);
            }
          }
        } else {
          console.log(`\n   ✅ Usernames match: "${userRecord.username}"`);
        }
      }
    } else {
      console.log(`\n   ⚠️  No USER record found with email ${email}`);
      console.log(`      This means the username might only exist in PROFILE.`);
    }

  } catch (error) {
    console.error(`\n❌ Error:`, error);
  }
}

findAllUsernameLocations();
