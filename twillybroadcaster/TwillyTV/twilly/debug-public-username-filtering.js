const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugPublicUsernameFiltering() {
  try {
    // Get user email from command line or use default
    const viewerEmail = process.argv[2] || 'dehyubuilds@gmail.com';
    console.log(`🔍 [DEBUG] Checking public username filtering for viewer: ${viewerEmail}\n`);

    // Step 1: Get all ADDED_USERNAME entries for this viewer
    console.log('📋 Step 1: Fetching ADDED_USERNAME entries...');
    const addedUsernamesParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${viewerEmail}`,
        ':skPrefix': 'ADDED_USERNAME#',
        ':status': 'active'
      }
    };

    const addedResult = await dynamodb.query(addedUsernamesParams).promise();
    const addedUsernames = addedResult.Items || [];
    
    console.log(`✅ Found ${addedUsernames.length} ADDED_USERNAME entries:\n`);
    
    const addedUsernamesPublic = new Set();
    const addedUsernamesPrivate = new Set();
    
    addedUsernames.forEach((item, index) => {
      const username = item.streamerUsername || 'MISSING';
      const visibility = item.streamerVisibility || 'public'; // Default to public if not set
      const usernameLower = username.toLowerCase();
      
      console.log(`  [${index + 1}] Username: "${username}"`);
      console.log(`      Email: ${item.streamerEmail || 'MISSING'}`);
      console.log(`      Visibility: "${visibility}" (raw: ${JSON.stringify(item.streamerVisibility)})`);
      console.log(`      Status: ${item.status || 'MISSING'}`);
      console.log(`      Added At: ${item.addedAt || 'MISSING'}`);
      
      if (visibility.toLowerCase() === 'private') {
        addedUsernamesPrivate.add(usernameLower);
        console.log(`      → Added to PRIVATE set (normalized: "${usernameLower}")`);
      } else {
        addedUsernamesPublic.add(usernameLower);
        console.log(`      → Added to PUBLIC set (normalized: "${usernameLower}")`);
      }
      console.log('');
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Public usernames (${addedUsernamesPublic.size}): [${Array.from(addedUsernamesPublic).join(', ')}]`);
    console.log(`   Private usernames (${addedUsernamesPrivate.size}): [${Array.from(addedUsernamesPrivate).join(', ')}]`);
    
    // Step 2: Get some recent videos from Twilly TV to check their usernames
    console.log(`\n📋 Step 2: Checking recent videos from Twilly TV...`);
    // Query for videos under the master account (Twilly TV)
    const channelQueryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':skPrefix': 'FILE#'
      },
      FilterExpression: 'category = :category',
      ExpressionAttributeNames: {
        '#category': 'category'
      },
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':skPrefix': 'FILE#',
        ':category': 'Videos'
      },
      Limit: 20,
      ScanIndexForward: false // Most recent first
    };
    
    const videoResult = await dynamodb.query(channelQueryParams).promise();
    const videos = (videoResult.Items || []).filter(item => item.category === 'Videos');
    
    console.log(`✅ Found ${videos.length} recent videos:\n`);
    
    videos.forEach((video, index) => {
      const creatorUsername = video.creatorUsername || 'NOT SET';
      const creatorUsernameLower = creatorUsername.toLowerCase().trim();
      const isPrivate = (creatorUsername && creatorUsername.includes('🔒')) || (video.isPrivateUsername === true);
      const usernameWithoutLock = creatorUsernameLower.replace('🔒', '').trim();
      
      console.log(`  [${index + 1}] Video: ${video.fileName || video.SK}`);
      console.log(`      creatorUsername: "${creatorUsername}"`);
      console.log(`      Normalized: "${creatorUsernameLower}"`);
      console.log(`      Without 🔒: "${usernameWithoutLock}"`);
      console.log(`      Is Private: ${isPrivate}`);
      
      if (isPrivate) {
        const hasAddedForPrivate = addedUsernamesPrivate.has(usernameWithoutLock);
        console.log(`      → Should show in PRIVATE view: ${hasAddedForPrivate ? '✅ YES' : '❌ NO'}`);
        if (!hasAddedForPrivate) {
          console.log(`         Available private usernames: [${Array.from(addedUsernamesPrivate).join(', ')}]`);
        }
      } else {
        const hasAddedForPublic = addedUsernamesPublic.has(creatorUsernameLower);
        console.log(`      → Should show in PUBLIC view: ${hasAddedForPublic ? '✅ YES' : '❌ NO'}`);
        if (!hasAddedForPublic) {
          console.log(`         Available public usernames: [${Array.from(addedUsernamesPublic).join(', ')}]`);
          // Check for close matches
          const closeMatch = Array.from(addedUsernamesPublic).find(u => u.trim() === creatorUsernameLower.trim());
          if (closeMatch) {
            console.log(`         ⚠️ Found close match: "${closeMatch}" (might be a normalization issue)`);
          }
        }
      }
      console.log('');
    });
    
    console.log(`\n✅ Debug complete!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugPublicUsernameFiltering();
