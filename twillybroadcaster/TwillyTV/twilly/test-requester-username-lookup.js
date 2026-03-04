import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function testRequesterUsernameLookup() {
  // Test with a few different emails to see what happens
  const testEmails = [
    'dehyubuilds@gmail.com',
    'dehyu.sinyan@gmail.com',
    'dehyu1@umbc.edu'
  ];

  console.log(`🔍 Testing requester username lookup logic\n`);
  console.log('='.repeat(60));

  for (const requesterEmail of testEmails) {
    console.log(`\n📧 Testing with email: ${requesterEmail}`);
    console.log('-'.repeat(60));

    // PRIORITY 1: Check USER record (PK='USER', SK=userId) - this is the source of truth
    let requesterUsername = null;
    
    // First, try to find userId from email by scanning USER records
    try {
      const userScanParams = {
        TableName: table,
        FilterExpression: 'PK = :pk AND email = :email',
        ExpressionAttributeValues: {
          ':pk': 'USER',
          ':email': requesterEmail
        },
        Limit: 1
      };
      const userScanResult = await dynamodb.scan(userScanParams).promise();
      console.log(`   USER scan result: ${userScanResult.Items?.length || 0} items`);
      if (userScanResult.Items && userScanResult.Items.length > 0) {
        const userRecord = userScanResult.Items[0];
        requesterUsername = userRecord.username;
        console.log(`   ✅ Found username from USER record: "${requesterUsername}"`);
        console.log(`      SK (userId): ${userRecord.SK}`);
      } else {
        console.log(`   ❌ No USER record found`);
      }
    } catch (userScanError) {
      console.log(`   ⚠️  Error scanning USER records: ${userScanError.message}`);
    }
    
    // PRIORITY 2: Fallback to PROFILE if USER record lookup failed
    if (!requesterUsername) {
      console.log(`   Trying PROFILE lookup...`);
      const requesterProfileParams = {
        TableName: table,
        Key: {
          PK: `USER#${requesterEmail}`,
          SK: 'PROFILE'
        }
      };
      const requesterProfile = await dynamodb.get(requesterProfileParams).promise();
      requesterUsername = requesterProfile.Item?.username || null;
      if (requesterUsername) {
        console.log(`   ✅ Found username from PROFILE: "${requesterUsername}"`);
      } else {
        console.log(`   ❌ No PROFILE record found or no username`);
      }
    }
    
    // Final fallback: use email prefix
    if (!requesterUsername) {
      requesterUsername = requesterEmail.split('@')[0];
      console.log(`   ⚠️  Using email prefix as username: "${requesterUsername}"`);
    }

    console.log(`   📋 Final username: "${requesterUsername}"`);
  }
}

testRequesterUsernameLookup();
