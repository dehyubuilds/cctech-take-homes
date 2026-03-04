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
  console.log(`🔍 Finding user email for username: ${username}...\n`);
  
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
  console.log(`✅ Found user email: ${userEmail}\n`);
  return userEmail;
}

async function find22SecondVideo() {
  try {
    const userEmail = await findUserEmail();
    const pk = `USER#${userEmail}`;

    console.log(`🔍 Searching for 22-second video with Twilly TV username...\n`);

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

    // Filter for videos that are approximately 22 seconds
    // Check duration field or calculate from metadata
    const candidateVideos = allFiles.filter(file => {
      // Check if it's a video (has .m3u8 or video-related fields)
      const isVideo = file.fileName?.includes('.m3u8') || 
                     file.category === 'Videos' || 
                     file.category === 'Video';
      
      // Check if creatorUsername contains "Twilly TV" (case insensitive)
      const creatorUsername = file.creatorUsername || '';
      const hasTwillyTV = creatorUsername.toLowerCase().includes('twilly');
      
      // Check if it's private
      const isPrivate = file.isPrivateUsername === true;
      
      return isVideo && hasTwillyTV && isPrivate;
    });

    console.log(`🎬 Found ${candidateVideos.length} candidate video(s) matching criteria:\n`);
    console.log(`   - Category: Videos\n`);
    console.log(`   - Creator username contains "Twilly TV"\n`);
    console.log(`   - isPrivateUsername: true\n\n`);

    // Display all candidates with full details
    for (const video of candidateVideos) {
      console.log('='.repeat(80));
      console.log(`📹 FileName: ${video.fileName || 'N/A'}`);
      console.log(`   SK: ${video.SK}`);
      console.log(`   PK: ${video.PK}`);
      console.log(`   Creator Username: "${video.creatorUsername || 'N/A'}"`);
      console.log(`   Creator Username (raw): ${JSON.stringify(video.creatorUsername)}`);
      console.log(`   isPrivateUsername: ${video.isPrivateUsername}`);
      console.log(`   Category: ${video.category || 'N/A'}`);
      console.log(`   Created At: ${video.createdAt || video.timestamp || 'N/A'}`);
      console.log(`   Duration: ${video.duration || 'N/A'}`);
      console.log(`   Title: ${video.title || 'N/A'}`);
      console.log(`   Description: ${video.description || 'N/A'}`);
      console.log(`   Stream Key: ${video.streamKey || 'N/A'}`);
      console.log(`   HLS URL: ${video.hlsUrl ? video.hlsUrl.substring(0, 80) + '...' : 'N/A'}`);
      
      // Check for duration-related fields
      if (video.duration) {
        const durationStr = String(video.duration);
        if (durationStr.includes('22') || durationStr === '22' || durationStr === '22.0') {
          console.log(`   ⚠️  DURATION MATCH: ${video.duration}`);
        }
      }
      
      // Check if fileName contains duration info
      if (video.fileName && video.fileName.includes('22')) {
        console.log(`   ⚠️  FILENAME CONTAINS "22": ${video.fileName}`);
      }
      
      console.log('');
    }

    // Also search for videos with "22" in filename or duration
    console.log('\n' + '='.repeat(80));
    console.log('🔍 Searching for videos with "22" in filename or duration...\n');
    
    const videosWith22 = allFiles.filter(file => {
      const fileName = file.fileName || '';
      const duration = String(file.duration || '');
      return fileName.includes('22') || duration.includes('22');
    });

    if (videosWith22.length > 0) {
      console.log(`Found ${videosWith22.length} video(s) with "22" in filename or duration:\n`);
      for (const video of videosWith22) {
        console.log(`📹 ${video.fileName || 'N/A'}`);
        console.log(`   SK: ${video.SK}`);
        console.log(`   Creator Username: "${video.creatorUsername || 'N/A'}"`);
        console.log(`   isPrivateUsername: ${video.isPrivateUsername}`);
        console.log(`   Category: ${video.category || 'N/A'}`);
        console.log(`   Duration: ${video.duration || 'N/A'}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

find22SecondVideo()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
