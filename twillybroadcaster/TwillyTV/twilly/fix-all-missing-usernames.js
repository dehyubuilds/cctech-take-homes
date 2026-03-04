const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixAllMissingUsernames() {
  console.log('🔧 Fixing all PROFILE entries with missing username or usernameVisibility...\n');
  
  // Get all PROFILE entries
  let allProfiles = [];
  let lastEvaluatedKey = null;
  
  do {
    const scanParams = {
      TableName: table,
      FilterExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':sk': 'PROFILE'
      },
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 100
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    allProfiles = allProfiles.concat(result.Items || []);
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`📋 Found ${allProfiles.length} PROFILE entries\n`);
  
  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const profile of allProfiles) {
    const email = profile.PK?.replace('USER#', '') || profile.email;
    const hasUsername = !!profile.username;
    const hasVisibility = !!profile.usernameVisibility;
    
    // Skip CREATOR# entries (those are old entries, not user profiles)
    if (profile.PK?.startsWith('CREATOR#')) {
      console.log(`⏭️  Skipping CREATOR entry: ${profile.PK}`);
      skipped++;
      continue;
    }
    
    // Skip if both are present
    if (hasUsername && hasVisibility) {
      continue;
    }
    
    console.log(`\n🔧 Fixing: ${email}`);
    
    // Try to get username from USER record
    let username = profile.username;
    if (!username) {
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
        const userResult = await dynamodb.scan(userScanParams).promise();
        if (userResult.Items && userResult.Items.length > 0) {
          username = userResult.Items[0].username;
          console.log(`   ✅ Found username in USER record: "${username}"`);
        }
      } catch (error) {
        console.log(`   ⚠️  Could not fetch username from USER record: ${error.message}`);
      }
    }
    
    // Build update expression
    const updates = [];
    const values = {};
    
    if (!hasUsername && username) {
      updates.push('username = :username');
      values[':username'] = username;
    }
    
    if (!hasVisibility) {
      updates.push('usernameVisibility = :visibility');
      values[':visibility'] = 'public'; // Default to public
    }
    
    if (updates.length === 0) {
      console.log(`   ⏭️  Nothing to fix (missing username but couldn't find it)`);
      skipped++;
      continue;
    }
    
    updates.push('updatedAt = :updatedAt');
    values[':updatedAt'] = new Date().toISOString();
    
    try {
      const updateParams = {
        TableName: table,
        Key: {
          PK: profile.PK,
          SK: profile.SK
        },
        UpdateExpression: `SET ${updates.join(', ')}`,
        ExpressionAttributeValues: values
      };
      
      await dynamodb.update(updateParams).promise();
      console.log(`   ✅ Fixed: ${updates.join(', ')}`);
      fixed++;
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n\n✅ Fix complete!`);
  console.log(`   Fixed: ${fixed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

fixAllMissingUsernames().catch(console.error);
