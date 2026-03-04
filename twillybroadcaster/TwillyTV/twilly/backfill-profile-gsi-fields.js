import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function backfillProfileGSIFields() {
  console.log('🔄 Backfilling PROFILE items with username and usernameVisibility for GSI...\n');

  let lastEvaluatedKey = null;
  let processed = 0;
  let updated = 0;
  let skipped = 0;

  do {
    const scanParams = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':sk': 'PROFILE'
      },
      ExclusiveStartKey: lastEvaluatedKey
    };

    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];

    for (const profile of items) {
      processed++;
      const email = profile.PK ? profile.PK.replace('USER#', '') : null;
      if (!email) continue;

      // Check if we need to update
      const needsUsername = !profile.username;
      const needsVisibility = !profile.usernameVisibility;

      if (!needsUsername && !needsVisibility) {
        skipped++;
        continue;
      }

      // Get username from USER record if missing
      let username = profile.username;
      if (!username && profile.userId) {
        try {
          const userResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: 'USER',
              SK: profile.userId
            }
          }).promise();
          if (userResult.Item && userResult.Item.username) {
            username = userResult.Item.username;
          }
        } catch (error) {
          console.log(`  ⚠️  Could not fetch username for ${email}: ${error.message}`);
        }
      }

      // Default visibility to public if missing
      const usernameVisibility = profile.usernameVisibility || 'public';

      // Update PROFILE item
      const updateParams = {
        TableName: table,
        Key: {
          PK: profile.PK,
          SK: profile.SK
        },
        UpdateExpression: 'SET updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      };

      if (needsUsername && username) {
        updateParams.UpdateExpression += ', username = :username';
        updateParams.ExpressionAttributeValues[':username'] = username;
      }

      if (needsVisibility) {
        updateParams.UpdateExpression += ', usernameVisibility = :visibility';
        updateParams.ExpressionAttributeValues[':visibility'] = usernameVisibility;
      }

      try {
        await dynamodb.update(updateParams).promise();
        updated++;
        console.log(`  ✅ Updated ${email}: username=${username || 'N/A'}, visibility=${usernameVisibility}`);
      } catch (error) {
        console.log(`  ❌ Failed to update ${email}: ${error.message}`);
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
    console.log(`Processed ${processed} profiles, updated ${updated}, skipped ${skipped}...`);
  } while (lastEvaluatedKey);

  console.log(`\n✅ Backfill complete!`);
  console.log(`   Total processed: ${processed}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (already complete): ${skipped}`);
}

backfillProfileGSIFields().catch(console.error);
