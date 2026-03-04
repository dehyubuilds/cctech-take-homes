const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkAllProfiles() {
  console.log('🔍 Checking all PROFILE entries for missing username field...\n');
  
  let allProfiles = [];
  let lastEvaluatedKey = null;
  let pageCount = 0;
  
  // Scan all PROFILE entries
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
    pageCount++;
    console.log(`   Scanned page ${pageCount}: ${result.Items?.length || 0} profiles (total: ${allProfiles.length})`);
  } while (lastEvaluatedKey);
  
  console.log(`\n✅ Total PROFILE entries found: ${allProfiles.length}\n`);
  
  // Analyze profiles
  const profilesWithUsername = [];
  const profilesMissingUsername = [];
  const profilesMissingVisibility = [];
  const profilesMissingBoth = [];
  
  for (const profile of allProfiles) {
    const hasUsername = !!profile.username;
    const hasVisibility = !!profile.usernameVisibility;
    
    if (hasUsername && hasVisibility) {
      profilesWithUsername.push(profile);
    } else if (!hasUsername && hasVisibility) {
      profilesMissingUsername.push(profile);
    } else if (hasUsername && !hasVisibility) {
      profilesMissingVisibility.push(profile);
    } else {
      profilesMissingBoth.push(profile);
    }
  }
  
  console.log('📊 Analysis Results:');
  console.log(`   ✅ Complete (has username + visibility): ${profilesWithUsername.length}`);
  console.log(`   ❌ Missing username (has visibility): ${profilesMissingUsername.length}`);
  console.log(`   ⚠️  Missing visibility (has username): ${profilesMissingVisibility.length}`);
  console.log(`   ❌ Missing both: ${profilesMissingBoth.length}`);
  
  // Show details of problematic profiles
  if (profilesMissingUsername.length > 0) {
    console.log(`\n❌ Profiles missing username (${profilesMissingUsername.length}):`);
    profilesMissingUsername.slice(0, 20).forEach((profile, idx) => {
      const email = profile.PK?.replace('USER#', '') || profile.email || 'unknown';
      console.log(`   ${idx + 1}. ${email} - visibility: "${profile.usernameVisibility || 'none'}"`);
    });
    if (profilesMissingUsername.length > 20) {
      console.log(`   ... and ${profilesMissingUsername.length - 20} more`);
    }
  }
  
  if (profilesMissingVisibility.length > 0) {
    console.log(`\n⚠️  Profiles missing visibility (${profilesMissingVisibility.length}):`);
    profilesMissingVisibility.slice(0, 20).forEach((profile, idx) => {
      const email = profile.PK?.replace('USER#', '') || profile.email || 'unknown';
      console.log(`   ${idx + 1}. ${email} - username: "${profile.username}"`);
    });
    if (profilesMissingVisibility.length > 20) {
      console.log(`   ... and ${profilesMissingVisibility.length - 20} more`);
    }
  }
  
  if (profilesMissingBoth.length > 0) {
    console.log(`\n❌ Profiles missing both (${profilesMissingBoth.length}):`);
    profilesMissingBoth.slice(0, 20).forEach((profile, idx) => {
      const email = profile.PK?.replace('USER#', '') || profile.email || 'unknown';
      console.log(`   ${idx + 1}. ${email}`);
    });
    if (profilesMissingBoth.length > 20) {
      console.log(`   ... and ${profilesMissingBoth.length - 20} more`);
    }
  }
  
  // Return summary for fixing
  return {
    total: allProfiles.length,
    complete: profilesWithUsername.length,
    missingUsername: profilesMissingUsername,
    missingVisibility: profilesMissingVisibility,
    missingBoth: profilesMissingBoth
  };
}

checkAllProfiles().then(result => {
  console.log('\n✅ Check complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
