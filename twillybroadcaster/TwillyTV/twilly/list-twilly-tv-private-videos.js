import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';
const username = 'Twilly TV';

async function findUserEmail() {
  const scanParams = {
    TableName: table,
    FilterExpression: 'PK = :pk AND username = :username',
    ExpressionAttributeValues: {
      ':pk': 'USER',
      ':username': username
    }
  };

  const result = await dynamodb.scan(scanParams).promise();
  const users = result.Items || [];

  if (users.length === 0) {
    throw new Error(`No user found with username: ${username}`);
  }

  const userEmail = users[0].email || users[0].SK;
  return userEmail;
}

function normalizeUsername(username) {
  if (!username) return null;
  return username.replace(/🔒/g, '').trim().toLowerCase();
}

async function listPrivateVideos() {
  try {
    const userEmail = await findUserEmail();
    const pk = `USER#${userEmail}`;

    console.log(`🔍 Listing all private videos for ${username} (${userEmail})...\n`);

    // Query all FILE records for this user
    let allFiles = [];
    let lastEvaluatedKey = null;

    do {
      const queryParams = {
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':skPrefix': 'FILE#'
        },
        ExclusiveStartKey: lastEvaluatedKey
      };

      const result = await dynamodb.query(queryParams).promise();
      if (result.Items) {
        allFiles = allFiles.concat(result.Items);
      }
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`📋 Found ${allFiles.length} total FILE records\n`);

    // Filter for private videos (isPrivateUsername === true OR creatorUsername contains "Twilly TV")
    const privateVideos = allFiles.filter(file => {
      const isPrivate = file.isPrivateUsername === true;
      const creatorUsername = file.creatorUsername || '';
      const hasTwillyTV = creatorUsername.toLowerCase().includes('twilly');
      const isVideo = file.category === 'Videos' || file.category === 'Video' || 
                     (file.fileName && file.fileName.includes('.m3u8'));
      
      // Include if it's marked as private OR if it's from Twilly TV (owner videos appear in private view)
      return isVideo && (isPrivate || hasTwillyTV);
    });

    console.log(`🔒 Found ${privateVideos.length} private video(s):\n`);
    console.log('='.repeat(100));

    // Group by creatorUsername format to identify variations
    const usernameGroups = {};
    for (const video of privateVideos) {
      const creatorUsername = video.creatorUsername || 'N/A';
      if (!usernameGroups[creatorUsername]) {
        usernameGroups[creatorUsername] = [];
      }
      usernameGroups[creatorUsername].push(video);
    }

    console.log(`\n📊 CREATOR USERNAME VARIATIONS (${Object.keys(usernameGroups).length} unique formats):\n`);
    
    for (const [creatorUsername, videos] of Object.entries(usernameGroups)) {
      const normalized = normalizeUsername(creatorUsername);
      console.log(`\n"${creatorUsername}" (normalized: "${normalized}") - ${videos.length} video(s)`);
      console.log(`   Raw bytes: ${JSON.stringify(creatorUsername)}`);
      console.log(`   Length: ${creatorUsername.length} characters`);
      console.log(`   Contains 🔒: ${creatorUsername.includes('🔒')}`);
      console.log(`   Has whitespace: ${creatorUsername !== creatorUsername.trim()}`);
      
      // Show first 3 examples
      for (let i = 0; i < Math.min(3, videos.length); i++) {
        const video = videos[i];
        console.log(`   Example ${i + 1}: ${video.fileName || video.SK}`);
        console.log(`      SK: ${video.SK}`);
        console.log(`      isPrivateUsername: ${video.isPrivateUsername}`);
        console.log(`      Category: ${video.category || 'N/A'}`);
      }
      if (videos.length > 3) {
        console.log(`   ... and ${videos.length - 3} more`);
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n📋 DETAILED LIST OF ALL PRIVATE VIDEOS:\n');

    // Sort by createdAt (newest first)
    privateVideos.sort((a, b) => {
      const aTime = a.createdAt || a.timestamp || '0';
      const bTime = b.createdAt || b.timestamp || '0';
      return bTime.localeCompare(aTime);
    });

    for (let i = 0; i < privateVideos.length; i++) {
      const video = privateVideos[i];
      const creatorUsername = video.creatorUsername || 'N/A';
      const normalized = normalizeUsername(creatorUsername);
      
      console.log(`\n[${i + 1}] ${video.fileName || video.SK}`);
      console.log(`    SK: ${video.SK}`);
      console.log(`    Creator Username: "${creatorUsername}"`);
      console.log(`    Creator Username (normalized): "${normalized}"`);
      console.log(`    Creator Username (raw JSON): ${JSON.stringify(creatorUsername)}`);
      console.log(`    isPrivateUsername: ${video.isPrivateUsername}`);
      console.log(`    Category: ${video.category || 'N/A'}`);
      console.log(`    Created At: ${video.createdAt || video.timestamp || 'N/A'}`);
      console.log(`    Title: ${video.title || 'N/A'}`);
      
      // Check if this might not match "Twilly TV" after normalization
      const viewerUsername = 'Twilly TV';
      const normalizedViewer = normalizeUsername(viewerUsername);
      const willMatch = normalized === normalizedViewer;
      
      if (!willMatch) {
        console.log(`    ⚠️  WARNING: This video might NOT match "My" filter!`);
        console.log(`       Normalized viewer: "${normalizedViewer}"`);
        console.log(`       Normalized creator: "${normalized}"`);
        console.log(`       Match: ${willMatch}`);
      }
    }

    console.log('\n' + '='.repeat(100));
    console.log('\n📊 SUMMARY:\n');
    console.log(`   Total private videos: ${privateVideos.length}`);
    console.log(`   Unique creator username formats: ${Object.keys(usernameGroups).length}`);
    console.log(`   Formats:`);
    for (const [creatorUsername, videos] of Object.entries(usernameGroups)) {
      const normalized = normalizeUsername(creatorUsername);
      const viewerNormalized = normalizeUsername('Twilly TV');
      const willMatch = normalized === viewerNormalized;
      const matchStatus = willMatch ? '✅ WILL MATCH' : '❌ WILL NOT MATCH';
      console.log(`      "${creatorUsername}" -> "${normalized}" (${videos.length} videos) ${matchStatus}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

listPrivateVideos()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
