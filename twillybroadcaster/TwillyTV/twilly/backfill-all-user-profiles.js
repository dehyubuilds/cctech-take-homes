import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function backfillAllUserProfiles() {
  console.log('🔄 Backfilling PROFILE items for all users in USER records...\n');

  let processed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let lastEvaluatedKey = null;

  // Step 1: Scan all USER records
  do {
    const scanParams = {
      TableName: table,
      FilterExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'USER'
      },
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 100
    };

    const result = await dynamodb.scan(scanParams).promise();
    const userRecords = result.Items || [];

    for (const userRecord of userRecords) {
      processed++;
      const username = userRecord.username;
      const userId = userRecord.SK; // userId is the SK in USER records
      const email = userRecord.email || userId;

      if (!username) {
        console.log(`  ⚠️  Skipping USER record without username: SK=${userId}`);
        skipped++;
        continue;
      }

      // Check if PROFILE item exists
      // Try both USER#email and USER#userId formats
      let profileExists = false;
      let existingProfile = null;

      // Try USER#email format first
      if (email && email !== userId) {
        try {
          const profileResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `USER#${email}`,
              SK: 'PROFILE'
            }
          }).promise();
          if (profileResult.Item) {
            profileExists = true;
            existingProfile = profileResult.Item;
          }
        } catch (error) {
          // Continue to try USER#userId format
        }
      }

      // Try USER#userId format if not found
      if (!profileExists) {
        try {
          const profileResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `USER#${userId}`,
              SK: 'PROFILE'
            }
          }).promise();
          if (profileResult.Item) {
            profileExists = true;
            existingProfile = profileResult.Item;
          }
        } catch (error) {
          // Profile doesn't exist, will create it
        }
      }

      if (profileExists && existingProfile) {
        // Profile exists, check if it needs updating
        const needsUsername = !existingProfile.username || existingProfile.username !== username;
        const needsVisibility = !existingProfile.usernameVisibility;

        if (needsUsername || needsVisibility) {
          // Update existing PROFILE
          const updateParams = {
            TableName: table,
            Key: {
              PK: existingProfile.PK,
              SK: existingProfile.SK
            },
            UpdateExpression: 'SET updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':updatedAt': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
          };

          if (needsUsername) {
            updateParams.UpdateExpression += ', username = :username';
            updateParams.ExpressionAttributeValues[':username'] = username;
          }

          if (needsVisibility) {
            updateParams.UpdateExpression += ', usernameVisibility = :visibility';
            updateParams.ExpressionAttributeValues[':visibility'] = 'public'; // Default to public
          }

          try {
            await dynamodb.update(updateParams).promise();
            updated++;
            console.log(`  ✅ Updated PROFILE for ${username} (${email})`);
          } catch (error) {
            console.error(`  ❌ Failed to update PROFILE for ${username}: ${error.message}`);
            errors++;
          }
        } else {
          skipped++;
        }
      } else {
        // Create new PROFILE item
        // Prefer USER#email format, fallback to USER#userId
        const profilePK = email && email !== userId ? `USER#${email}` : `USER#${userId}`;
        
        const profileItem = {
          PK: profilePK,
          SK: 'PROFILE',
          userId: userId,
          username: username,
          usernameVisibility: 'public', // Default to public
          email: email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Copy any additional fields from USER record
        if (userRecord.name) profileItem.name = userRecord.name;
        if (userRecord.avatar) profileItem.avatar = userRecord.avatar;

        try {
          await dynamodb.put({
            TableName: table,
            Item: profileItem
          }).promise();
          created++;
          console.log(`  ✅ Created PROFILE for ${username} (${email})`);
        } catch (error) {
          console.error(`  ❌ Failed to create PROFILE for ${username}: ${error.message}`);
          errors++;
        }
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
    console.log(`\n📊 Progress: Processed ${processed} users, Created ${created}, Updated ${updated}, Skipped ${skipped}, Errors ${errors}...`);
  } while (lastEvaluatedKey);

  console.log(`\n✅ Backfill complete!`);
  console.log(`   Total processed: ${processed}`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (already complete): ${skipped}`);
  console.log(`   Errors: ${errors}`);
  
  // Verify by checking GSI
  console.log(`\n🔍 Verifying GSI indexing...`);
  try {
    const publicResult = await dynamodb.query({
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility',
      ExpressionAttributeValues: {
        ':visibility': 'public'
      },
      Limit: 1
    }).promise();
    console.log(`   ✅ GSI is active and has ${publicResult.Count || 0} items (sample check)`);
  } catch (error) {
    console.error(`   ⚠️  Could not verify GSI: ${error.message}`);
  }
}

backfillAllUserProfiles().catch(console.error);
