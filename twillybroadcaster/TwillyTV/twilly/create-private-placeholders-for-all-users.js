const AWS = require('aws-sdk');

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function createPrivatePlaceholdersForAllUsers() {
  console.log('🔄 Creating placeholder private STREAM_KEY mappings for all users...\n');

  let processed = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;
  let lastEvaluatedKey = null;

  do {
    // Get all public users from PROFILE items
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
      if (!email) {
        skipped++;
        continue;
      }

      const username = profile.username || email.split('@')[0];
      const userId = profile.userId || email;
      const privateStreamKey = `sk_private_${userId.replace('@', '_').replace(/[^a-z0-9_]/gi, '')}`;
      const privateStreamUsername = `${username}🔒`;

      // Check if private mapping already exists
      try {
        const existingPrivateMapping = await dynamodb.get({
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${privateStreamKey}`,
            SK: 'MAPPING'
          }
        }).promise();

        if (existingPrivateMapping.Item) {
          console.log(`  ⏭️  Private mapping already exists for ${username} (${email})`);
          skipped++;
          continue;
        }

        // Check if user has a stream key to get channel info
        let channelName = 'Twilly TV';
        let channelId = null;
        
        // Try to find user's stream key to get channel info
        const streamKeyScan = await dynamodb.scan({
          TableName: table,
          FilterExpression: 'begins_with(PK, :pk) AND SK = :sk AND (collaboratorEmail = :email OR ownerEmail = :email)',
          ExpressionAttributeValues: {
            ':pk': 'STREAM_KEY#',
            ':sk': 'MAPPING',
            ':email': email
          },
          Limit: 1
        }).promise();

        if (streamKeyScan.Items && streamKeyScan.Items.length > 0) {
          const existingMapping = streamKeyScan.Items[0];
          channelName = existingMapping.channelName || existingMapping.seriesName || 'Twilly TV';
          channelId = existingMapping.channelId || null;
        }

        // Create placeholder private mapping
        // CRITICAL: Don't include channelId if it's null (GSI requires string, not null)
        const privateStreamKeyMapping = {
          PK: `STREAM_KEY#${privateStreamKey}`,
          SK: 'MAPPING',
          streamKey: privateStreamKey,
          streamUsername: privateStreamUsername, // Username with 🔒
          isPrivateUsername: true,
          collaboratorEmail: email,
          creatorId: userId,
          channelName: channelName,
          // Only include channelId if it's not null (GSI constraint)
          ...(channelId ? { channelId: channelId } : {}),
          isActive: true,
          isPersonalKey: false,
          isCollaboratorKey: true,
          isPlaceholder: true, // Flag to indicate this is a placeholder
          createdAt: new Date().toISOString(),
          status: 'ACTIVE'
        };

        await dynamodb.put({
          TableName: table,
          Item: privateStreamKeyMapping
        }).promise();

        console.log(`  ✅ Created private placeholder: ${privateStreamUsername} (${email})`);
        created++;
      } catch (error) {
        console.error(`  ❌ Error creating private placeholder for ${username} (${email}): ${error.message}`);
        errors++;
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`\n✅ Complete!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

createPrivatePlaceholdersForAllUsers().catch(console.error);
