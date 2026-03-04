import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugUserScan() {
  const email = 'dehyubuilds@gmail.com';
  console.log(`🔍 Debugging USER record scan for: ${email}\n`);
  console.log('='.repeat(60));

  // Try the exact scan we're using in the code
  console.log('\n1️⃣ Current scan (PK=USER AND email=:email):');
  console.log('-'.repeat(60));
  try {
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
    console.log(`   Result: ${userScanResult.Items?.length || 0} items`);
    if (userScanResult.Items && userScanResult.Items.length > 0) {
      console.log(`   Item:`, JSON.stringify(userScanResult.Items[0], null, 2));
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  // Try scanning all USER records and filtering manually
  console.log('\n2️⃣ Scan all USER records and filter:');
  console.log('-'.repeat(60));
  try {
    const allUserScanParams = {
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
        ...allUserScanParams,
        ExclusiveStartKey: lastEvaluatedKey
      };
      const result = await dynamodb.scan(paginatedParams).promise();
      allUserRecords = allUserRecords.concat(result.Items || []);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`   Total USER records: ${allUserRecords.length}`);
    
    // Filter manually
    const matching = allUserRecords.filter(r => r.email === email || r.userEmail === email);
    console.log(`   Records with email ${email}: ${matching.length}`);
    if (matching.length > 0) {
      console.log(`   Matching record:`, JSON.stringify(matching[0], null, 2));
      console.log(`   Username: "${matching[0].username || 'N/A'}"`);
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  // Check what fields exist in USER records
  console.log('\n3️⃣ Sample USER record structure:');
  console.log('-'.repeat(60));
  try {
    const sampleScanParams = {
      TableName: table,
      FilterExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'USER'
      },
      Limit: 5
    };
    const sampleResult = await dynamodb.scan(sampleScanParams).promise();
    if (sampleResult.Items && sampleResult.Items.length > 0) {
      console.log(`   Sample record fields:`, Object.keys(sampleResult.Items[0]));
      console.log(`   Sample record:`, JSON.stringify(sampleResult.Items[0], null, 2));
    }
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
}

debugUserScan();
