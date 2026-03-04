import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function cleanupSelfAddedUsernames() {
  console.log('🧹 Starting cleanup of all self-added usernames...\n');

  let totalDeleted = 0;
  let totalUsersProcessed = 0;
  let totalErrors = 0;

  try {
    // Scan all users to get their emails
    // We'll look for USER#email entries or USER entries with email field
    console.log('📋 Scanning for all users...');
    
    let lastEvaluatedKey = null;
    let allUserEmails = new Set();

    do {
      const scanParams = {
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix)',
        ExpressionAttributeValues: {
          ':pkPrefix': 'USER#'
        },
        ExclusiveStartKey: lastEvaluatedKey
      };

      const result = await dynamodb.scan(scanParams).promise();
      
      if (result.Items) {
        for (const item of result.Items) {
          // Extract email from PK (USER#email) or from item.email
          if (item.PK && item.PK.startsWith('USER#')) {
            const email = item.PK.replace('USER#', '');
            if (email && email.includes('@')) {
              allUserEmails.add(email);
            }
          }
          // Also check if item has email field (for USER records)
          if (item.email && item.email.includes('@')) {
            allUserEmails.add(item.email);
          }
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
      console.log(`   Found ${allUserEmails.size} unique user emails so far...`);
    } while (lastEvaluatedKey);

    console.log(`\n✅ Found ${allUserEmails.size} unique user emails\n`);

    // For each user email, find and delete self-added usernames
    for (const userEmail of allUserEmails) {
      totalUsersProcessed++;
      
      try {
        console.log(`\n👤 Processing user: ${userEmail}`);
        
        // Query all ADDED_USERNAME entries for this user
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

        if (addedUsernames.length === 0) {
          console.log(`   ✅ No added usernames found for this user`);
          continue;
        }

        console.log(`   📋 Found ${addedUsernames.length} added username entries`);

        // Find entries where streamerEmail matches userEmail (self-added)
        const userEmailLower = userEmail.toLowerCase().trim();
        const selfAddedEntries = addedUsernames.filter(item => {
          const streamerEmail = (item.streamerEmail || '').toLowerCase().trim();
          return streamerEmail === userEmailLower;
        });

        if (selfAddedEntries.length === 0) {
          console.log(`   ✅ No self-added usernames found`);
          continue;
        }

        console.log(`   🗑️  Found ${selfAddedEntries.length} self-added username(s) to delete:`);
        for (const entry of selfAddedEntries) {
          console.log(`      - ${entry.streamerUsername || 'Unknown'} (SK: ${entry.SK})`);
        }

        // Delete all self-added entries
        let deletedForUser = 0;
        for (const entry of selfAddedEntries) {
          try {
            const deleteParams = {
              TableName: table,
              Key: {
                PK: entry.PK,
                SK: entry.SK
              }
            };
            await dynamodb.delete(deleteParams).promise();
            deletedForUser++;
            totalDeleted++;
          } catch (deleteError) {
            console.error(`      ❌ Error deleting ${entry.SK}: ${deleteError.message}`);
            totalErrors++;
          }
        }

        if (deletedForUser > 0) {
          console.log(`   ✅ Deleted ${deletedForUser} self-added username(s) for ${userEmail}`);
        }

      } catch (userError) {
        console.error(`   ❌ Error processing user ${userEmail}: ${userError.message}`);
        totalErrors++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 CLEANUP SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Users processed: ${totalUsersProcessed}`);
    console.log(`   Self-added usernames deleted: ${totalDeleted}`);
    console.log(`   Errors encountered: ${totalErrors}`);
    console.log('='.repeat(60));
    console.log('\n✅ Cleanup completed!\n');

  } catch (error) {
    console.error('\n❌ Fatal error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupSelfAddedUsernames()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
