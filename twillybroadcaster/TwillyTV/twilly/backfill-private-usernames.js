import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function backfillPrivateUsernames() {
  console.log('🔄 Backfilling private usernames and usernameVisibility...\n');

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let lastEvaluatedKey = null;

  // Scan all PROFILE items
  do {
    const scanParams = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':sk': 'PROFILE'
      },
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 100
    };

    const result = await dynamodb.scan(scanParams).promise();
    const profiles = result.Items || [];

    for (const profile of profiles) {
      processed++;
      const email = profile.PK ? profile.PK.replace('USER#', '') : null;
      if (!email) continue;

      const hasPrivateUsername = !!profile.privateUsername;
      const currentVisibility = profile.usernameVisibility || 'public';
      
      // Check if user has set their account to private via set-visibility API
      // Users can be private even without a privateUsername field
      // The key is: if usernameVisibility is 'private', they should be searchable as private
      // OR if they have privateUsername set, they should be private
      const shouldBePrivate = hasPrivateUsername || currentVisibility === 'private';

      // If user should be private but usernameVisibility is not 'private', update it
      if (shouldBePrivate && currentVisibility !== 'private') {
        const updateParams = {
          TableName: table,
          Key: {
            PK: profile.PK,
            SK: profile.SK
          },
          UpdateExpression: 'SET usernameVisibility = :visibility, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':visibility': 'private',
            ':updatedAt': new Date().toISOString()
          },
          ReturnValues: 'ALL_NEW'
        };

        try {
          await dynamodb.update(updateParams).promise();
          updated++;
          console.log(`  ✅ Updated ${email}: Set usernameVisibility to 'private' (has privateUsername: ${profile.privateUsername})`);
        } catch (error) {
          console.error(`  ❌ Failed to update ${email}: ${error.message}`);
          errors++;
        }
      } else if (!shouldBePrivate && currentVisibility === 'private') {
        // If user doesn't have privateUsername but visibility is private, set to public
        const updateParams = {
          TableName: table,
          Key: {
            PK: profile.PK,
            SK: profile.SK
          },
          UpdateExpression: 'SET usernameVisibility = :visibility, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':visibility': 'public',
            ':updatedAt': new Date().toISOString()
          },
          ReturnValues: 'ALL_NEW'
        };

        try {
          await dynamodb.update(updateParams).promise();
          updated++;
          console.log(`  ✅ Updated ${email}: Set usernameVisibility to 'public' (no privateUsername)`);
        } catch (error) {
          console.error(`  ❌ Failed to update ${email}: ${error.message}`);
          errors++;
        }
      } else {
        skipped++;
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
    console.log(`\n📊 Progress: Processed ${processed} profiles, Updated ${updated}, Skipped ${skipped}, Errors ${errors}...`);
  } while (lastEvaluatedKey);

  console.log(`\n✅ Backfill complete!`);
  console.log(`   Total processed: ${processed}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (already correct): ${skipped}`);
  console.log(`   Errors: ${errors}`);
  
  // Verify by checking GSI
  console.log(`\n🔍 Verifying GSI indexing...`);
  try {
    const privateResult = await dynamodb.query({
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility',
      ExpressionAttributeValues: {
        ':visibility': 'private'
      },
      Limit: 10
    }).promise();
    console.log(`   ✅ GSI private partition has ${privateResult.Items?.length || 0} items`);
    if (privateResult.Items && privateResult.Items.length > 0) {
      console.log(`   Sample private usernames:`);
      privateResult.Items.slice(0, 5).forEach(item => {
        console.log(`     - ${item.username} (privateUsername: ${item.privateUsername || 'N/A'})`);
      });
    }
  } catch (error) {
    console.error(`   ⚠️  Could not verify GSI: ${error.message}`);
  }
}

backfillPrivateUsernames().catch(console.error);
