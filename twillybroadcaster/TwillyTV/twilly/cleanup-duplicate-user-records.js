import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicate USER records...\n');

  try {
    // Get all USER records (PK='USER')
    const scanParams = {
      TableName: table,
      FilterExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'USER'
      }
    };

    let allUserRecords = [];
    let lastEvaluatedKey = null;

    do {
      const result = await dynamodb.scan(scanParams).promise();
      if (result.Items) {
        allUserRecords = allUserRecords.concat(result.Items);
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`📋 Found ${allUserRecords.length} USER records\n`);

    // Group by email to find duplicates
    const emailGroups = {};
    for (const record of allUserRecords) {
      if (record.email) {
        const email = record.email.toLowerCase().trim();
        if (!emailGroups[email]) {
          emailGroups[email] = [];
        }
        emailGroups[email].push(record);
      }
    }

    // Find emails with multiple records
    const duplicates = Object.entries(emailGroups).filter(([email, records]) => records.length > 1);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate USER records found!\n');
      return;
    }

    console.log(`⚠️  Found ${duplicates.length} email(s) with duplicate USER records:\n`);

    let totalDeleted = 0;

    for (const [email, records] of duplicates) {
      console.log(`\n📧 Email: ${email}`);
      console.log(`   Found ${records.length} USER records:`);
      
      // Sort by updatedAt (most recent first) or createdAt
      records.sort((a, b) => {
        const aTime = a.updatedAt || a.createdAt || '0';
        const bTime = b.updatedAt || b.createdAt || '0';
        return bTime.localeCompare(aTime);
      });

      // Keep the most recent one, delete the rest
      const keepRecord = records[0];
      const deleteRecords = records.slice(1);

      console.log(`   ✅ KEEPING: SK=${keepRecord.SK}, Username=${keepRecord.username || 'N/A'}, Updated=${keepRecord.updatedAt || keepRecord.createdAt || 'N/A'}`);

      for (const record of deleteRecords) {
        console.log(`   🗑️  DELETING: SK=${record.SK}, Username=${record.username || 'N/A'}, Updated=${record.updatedAt || record.createdAt || 'N/A'}`);
        
        try {
          const deleteParams = {
            TableName: table,
            Key: {
              PK: record.PK,
              SK: record.SK
            }
          };
          await dynamodb.delete(deleteParams).promise();
          totalDeleted++;
          console.log(`      ✅ Deleted successfully`);
        } catch (deleteError) {
          console.error(`      ❌ Error deleting: ${deleteError.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Emails with duplicates: ${duplicates.length}`);
    console.log(`   Duplicate records deleted: ${totalDeleted}`);
    console.log('='.repeat(60));
    console.log('\n✅ Cleanup completed!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

cleanupDuplicates()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
