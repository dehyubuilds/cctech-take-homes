import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function createPrivateAccountsForAllUsers() {
  console.log('🔄 Creating private accounts (with 🔒) for all public users...\n');

  let processed = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Get all public users
  let lastEvaluatedKey = null;
  do {
    const publicResult = await dynamodb.query({
      TableName: table,
      IndexName: 'UsernameSearchIndex',
      KeyConditionExpression: 'usernameVisibility = :visibility',
      ExpressionAttributeValues: { ':visibility': 'public' },
      ExclusiveStartKey: lastEvaluatedKey
    }).promise();

    const publicUsers = publicResult.Items || [];

    for (const publicUser of publicUsers) {
      processed++;
      const username = publicUser.username;
      const email = publicUser.PK ? publicUser.PK.replace('USER#', '') : null;
      
      if (!username || !email) {
        skipped++;
        continue;
      }

      // Check PROFILE directly to see if user already has privateUsername set
      const profileCheck = await dynamodb.get({
        TableName: table,
        Key: {
          PK: publicUser.PK,
          SK: 'PROFILE'
        }
      }).promise();

      // If user already has privateUsername set, skip
      if (profileCheck.Item && profileCheck.Item.privateUsername) {
        console.log(`  ⏭️  User ${username} already has privateUsername: ${profileCheck.Item.privateUsername}`);
        skipped++;
        continue;
      }

      // If user already has usernameVisibility: 'private', skip
      // (they might have switched from public to private)
      if (profileCheck.Item && profileCheck.Item.usernameVisibility === 'private') {
        console.log(`  ⏭️  User ${username} is already set to private, skipping`);
        skipped++;
        continue;
      }

      const privateUsername = `${username}🔒`;

      // Create private account entry in PROFILE
      // We'll add a privateUsername field and create a duplicate entry with usernameVisibility: 'private'
      // Actually, wait - I think the user wants separate PROFILE entries or separate accounts
      // Let me check the structure...

      // Actually, I think what we need is:
      // 1. Keep the public PROFILE as is (usernameVisibility: 'public')
      // 2. Create a NEW PROFILE entry with the same email but usernameVisibility: 'private' and username: 'username🔒'
      
      // But that doesn't make sense with the GSI structure...
      
      // OR: Update the existing PROFILE to have BOTH public and private usernames
      // And create a separate entry in the GSI for the private version
      
      // Actually, I think the solution is simpler:
      // Update the PROFILE to have privateUsername set, and set usernameVisibility to allow both
      // OR create a duplicate PROFILE entry with usernameVisibility: 'private'
      
      // Let me check what the user actually wants - I think they want the SAME user to appear in both tabs
      // So we need to index the same PROFILE in both GSI partitions
      
      // Actually wait - the GSI partitions by usernameVisibility, so we can't have the same item in both
      // UNLESS we create a duplicate PROFILE entry
      
      // I think the solution is: Create a duplicate PROFILE entry with:
      // - Same PK (USER#email)
      // - Different SK? No, SK is always 'PROFILE'
      // - But usernameVisibility: 'private' and username: 'username🔒'
      
      // Actually, we can't have duplicate PK/SK pairs. So we need a different approach.
      
      // I think what we need is to UPDATE the existing PROFILE to include privateUsername
      // AND create a way to query it as both public and private
      
      // OR: The user wants EVERY public user to automatically have usernameVisibility set to allow both
      // But that doesn't work with GSI partitioning...
      
      // Let me re-read the requirement: "every public user should always have a corresponding private user"
      // I think this means: For every public user, create a private account entry
      
      // The solution: Update PROFILE to set privateUsername, then ALSO update usernameVisibility to 'private' 
      // But that would remove them from public...
      
      // OR: Create a separate PROFILE-like entry with a different structure
      // OR: Use a different SK like 'PROFILE_PRIVATE'
      
      // Actually, I think the simplest solution is:
      // For each public user, ensure they have privateUsername set to 'username🔒'
      // And when searching private tab, also check for users who have privateUsername set
      
      // But wait, the GSI only indexes by usernameVisibility, not by privateUsername
      
      // I think the real solution is: Create duplicate entries in a way that works with GSI
      // OR modify the search to also check public users who have privateUsername set
      
      // Let me just create privateUsername for all public users and update the search logic
      const updateParams = {
        TableName: table,
        Key: {
          PK: publicUser.PK,
          SK: 'PROFILE'
        },
        UpdateExpression: 'SET privateUsername = :privateUsername, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':privateUsername': privateUsername,
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      };

      try {
        await dynamodb.update(updateParams).promise();
        created++;
        console.log(`  ✅ Created private account for ${username}: ${privateUsername}`);
      } catch (error) {
        console.error(`  ❌ Failed to create private account for ${username}: ${error.message}`);
        errors++;
      }
    }

    lastEvaluatedKey = publicResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`\n✅ Complete!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

createPrivateAccountsForAllUsers().catch(console.error);
