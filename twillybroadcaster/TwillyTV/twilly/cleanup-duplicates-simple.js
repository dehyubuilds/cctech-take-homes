import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function cleanup() {
  console.log('🧹 Cleaning duplicate USER records...\n');

  // Get all USER records
  const scanParams = {
    TableName: table,
    FilterExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': 'USER' }
  };

  let allRecords = [];
  let lastKey = null;

  do {
    const result = await dynamodb.scan({ ...scanParams, ExclusiveStartKey: lastKey }).promise();
    if (result.Items) allRecords = allRecords.concat(result.Items);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Found ${allRecords.length} USER records\n`);

  // Group by email
  const byEmail = {};
  for (const record of allRecords) {
    if (record.email) {
      const email = record.email.toLowerCase().trim();
      if (!byEmail[email]) byEmail[email] = [];
      byEmail[email].push(record);
    }
  }

  // Find duplicates
  const duplicates = Object.entries(byEmail).filter(([_, records]) => records.length > 1);
  console.log(`Found ${duplicates.length} emails with duplicates\n`);

  let deleted = 0;
  for (const [email, records] of duplicates) {
    // Sort: keep most recent, or keep one with matching userId if provided
    records.sort((a, b) => {
      const aTime = a.updatedAt || a.createdAt || '0';
      const bTime = b.updatedAt || b.createdAt || '0';
      return bTime.localeCompare(aTime);
    });

    const keep = records[0];
    const remove = records.slice(1);

    console.log(`📧 ${email}: Keeping SK=${keep.SK} (${keep.username || 'N/A'}), deleting ${remove.length} duplicate(s)`);

    for (const record of remove) {
      try {
        await dynamodb.delete({
          TableName: table,
          Key: { PK: 'USER', SK: record.SK }
        }).promise();
        deleted++;
        console.log(`   ✅ Deleted SK=${record.SK} (${record.username || 'N/A'})`);
      } catch (err) {
        console.error(`   ❌ Error deleting SK=${record.SK}: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ Deleted ${deleted} duplicate records`);
}

cleanup().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
