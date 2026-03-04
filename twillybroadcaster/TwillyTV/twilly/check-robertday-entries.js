import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkRobertDayEntries() {
  console.log('🔍 Checking for RobertDay entries...\n');

  try {
    // Scan for all ADDED_USERNAME entries with streamerUsername containing "RobertDay" or "robday"
    const scanParams = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'ADDED_USERNAME#'
      }
    };

    let allEntries = [];
    let lastEvaluatedKey = null;

    do {
      const result = await dynamodb.scan(scanParams).promise();
      if (result.Items) {
        allEntries = allEntries.concat(result.Items);
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`📋 Found ${allEntries.length} total ADDED_USERNAME entries\n`);

    // Filter for RobertDay entries (case-insensitive)
    const robertDayEntries = allEntries.filter(item => {
      const username = (item.streamerUsername || '').toLowerCase();
      return username.includes('robertday') || username.includes('robday');
    });

    if (robertDayEntries.length === 0) {
      console.log('✅ No RobertDay entries found!\n');
      return;
    }

    console.log(`⚠️  Found ${robertDayEntries.length} RobertDay entry/entries:\n`);

    for (const entry of robertDayEntries) {
      const userEmail = entry.PK.replace('USER#', '');
      const streamerEmail = entry.streamerEmail || 'N/A';
      const streamerUsername = entry.streamerUsername || 'N/A';
      const isSelfAdded = streamerEmail.toLowerCase() === userEmail.toLowerCase();

      console.log(`   Entry:`);
      console.log(`      User: ${userEmail}`);
      console.log(`      Streamer Username: ${streamerUsername}`);
      console.log(`      Streamer Email: ${streamerEmail}`);
      console.log(`      SK: ${entry.SK}`);
      console.log(`      Self-Added: ${isSelfAdded ? 'YES ⚠️' : 'NO'}`);
      console.log(`      Visibility: ${entry.streamerVisibility || 'N/A'}`);
      console.log('');
    }

    // Check if any are self-added
    const selfAdded = robertDayEntries.filter(entry => {
      const userEmail = entry.PK.replace('USER#', '').toLowerCase();
      const streamerEmail = (entry.streamerEmail || '').toLowerCase();
      return streamerEmail === userEmail;
    });

    if (selfAdded.length > 0) {
      console.log(`\n⚠️  Found ${selfAdded.length} self-added RobertDay entry/entries that should be deleted!\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkRobertDayEntries()
  .then(() => {
    console.log('✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
