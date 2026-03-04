import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixAllPrivateAccounts() {
  console.log('🔄 Fixing all private accounts for searchability...\n');

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
      const username = profile.username;
      
      // Determine if account should be private:
      // 1. If they have privateUsername set, they should be private
      // 2. If usernameVisibility is already 'private', keep it private
      // 3. Otherwise, they're public
      const shouldBePrivate = hasPrivateUsername || currentVisibility === 'private';
      const needsUpdate = (shouldBePrivate && currentVisibility !== 'private') || 
                         (!shouldBePrivate && currentVisibility === 'private');

      if (needsUpdate) {
        const newVisibility = shouldBePrivate ? 'private' : 'public';
        const updateParams = {
          TableName: table,
          Key: {
            PK: profile.PK,
            SK: profile.SK
          },
          UpdateExpression: 'SET usernameVisibility = :visibility, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':visibility': newVisibility,
            ':updatedAt': new Date().toISOString()
          },
          ReturnValues: 'ALL_NEW'
        };

        try {
          await dynamodb.update(updateParams).promise();
          updated++;
          const reason = hasPrivateUsername ? 'has privateUsername' : 'was set to private';
          console.log(`  ✅ Updated ${username || email}: Set usernameVisibility to '${newVisibility}' (${reason})`);
        } catch (error) {
          console.error(`  ❌ Failed to update ${email}: ${error.message}`);
          errors++;
        }
      } else {
        skipped++;
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
    if (processed % 10 === 0) {
      console.log(`\n📊 Progress: Processed ${processed} profiles, Updated ${updated}, Skipped ${skipped}, Errors ${errors}...`);
    }
  } while (lastEvaluatedKey);

  console.log(`\n✅ Fix complete!`);
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
      Limit: 20
    }).promise();
    console.log(`   ✅ GSI private partition has ${privateResult.Items?.length || 0} items`);
    if (privateResult.Items && privateResult.Items.length > 0) {
      console.log(`   Private usernames found:`);
      privateResult.Items.forEach(item => {
        console.log(`     - ${item.username}${item.privateUsername ? ` (privateUsername: ${item.privateUsername})` : ''}`);
      });
    }
    
    const publicResult = await dynamodb.query({
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility',
      ExpressionAttributeValues: {
        ':visibility': 'public'
      },
      Limit: 5
    }).promise();
    console.log(`   ✅ GSI public partition has ${publicResult.Count || 0} items (sample)`);
  } catch (error) {
    console.error(`   ⚠️  Could not verify GSI: ${error.message}`);
  }
}

fixAllPrivateAccounts().catch(console.error);
