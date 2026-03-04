const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkAddedUsernameEntries() {
  try {
    const viewerEmail = process.argv[2] || 'dehyubuilds@gmail.com';
    console.log(`🔍 Checking ADDED_USERNAME entries for: ${viewerEmail}\n`);
    
    // Query for all ADDED_USERNAME entries (including inactive ones)
    const params = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${viewerEmail}`,
        ':skPrefix': 'ADDED_USERNAME#'
      }
    };
    
    const result = await dynamodb.query(params).promise();
    const entries = result.Items || [];
    
    console.log(`📊 Found ${entries.length} total ADDED_USERNAME entries:\n`);
    
    if (entries.length === 0) {
      console.log('❌ NO ADDED_USERNAME ENTRIES FOUND!');
      console.log('\n🔍 This means:');
      console.log('   1. The "Add" button clicks did NOT create entries in DynamoDB');
      console.log('   2. Either the API call failed, or the entry creation logic failed');
      console.log('   3. Check backend logs for request-follow API calls');
      console.log('\n💡 Next steps:');
      console.log('   - Check if request-follow API is being called');
      console.log('   - Check if visibility check is passing (should be "public")');
      console.log('   - Check if auto-accept logic is executing');
    } else {
      entries.forEach((entry, index) => {
        console.log(`  [${index + 1}] ${entry.streamerUsername || 'MISSING'}`);
        console.log(`      Email: ${entry.streamerEmail || 'MISSING'}`);
        console.log(`      Visibility: ${entry.streamerVisibility || 'public (default)'}`);
        console.log(`      Status: ${entry.status || 'MISSING'}`);
        console.log(`      Auto Accepted: ${entry.autoAccepted || false}`);
        console.log(`      Added At: ${entry.addedAt || 'MISSING'}`);
        console.log('');
      });
    }
    
    // Also check for POM-J and dehyuusername specifically
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Checking for specific usernames: POM-J, dehyuusername\n');
    
    const targetUsernames = ['POM-J', 'dehyuusername'];
    for (const targetUsername of targetUsernames) {
      const found = entries.find(e => {
        const entryUsername = (e.streamerUsername || '').toLowerCase().trim();
        return entryUsername === targetUsername.toLowerCase().trim();
      });
      
      if (found) {
        console.log(`✅ Found "${targetUsername}":`);
        console.log(`   Visibility: ${found.streamerVisibility || 'public (default)'}`);
        console.log(`   Status: ${found.status || 'MISSING'}`);
        console.log(`   Email: ${found.streamerEmail || 'MISSING'}`);
      } else {
        console.log(`❌ NOT FOUND: "${targetUsername}"`);
        console.log(`   This username was NOT added to your timeline`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAddedUsernameEntries();
