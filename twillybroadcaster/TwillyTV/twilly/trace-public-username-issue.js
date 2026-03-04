const AWS = require('aws-sdk');

// Configure AWS - use environment variables or check backend files for correct credentials
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function tracePublicUsernameIssue() {
  try {
    // Get viewer email from command line or use default
    const viewerEmail = process.argv[2] || 'dehyubuilds@gmail.com';
    const usernamesToCheck = ['POM-J', 'dehyuusername'];
    
    console.log(`🔍 [TRACE] Tracing public username issue for viewer: ${viewerEmail}\n`);
    console.log(`📋 Checking usernames: ${usernamesToCheck.join(', ')}\n`);
    
    // Step 1: Get viewer's own profile username
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Step 1: Getting viewer\'s profile username from settings...');
    let viewerProfileUsername = null;
    try {
      const viewerProfileParams = {
        TableName: table,
        Key: {
          PK: `USER#${viewerEmail}`,
          SK: 'PROFILE'
        }
      };
      const viewerProfileResult = await dynamodb.get(viewerProfileParams).promise();
      if (viewerProfileResult.Item && viewerProfileResult.Item.username) {
        viewerProfileUsername = viewerProfileResult.Item.username;
        console.log(`✅ Viewer's profile username: "${viewerProfileUsername}"`);
        console.log(`   Visibility: ${viewerProfileResult.Item.usernameVisibility || 'public (default)'}`);
      } else {
        console.log(`❌ Viewer profile not found or username not set`);
      }
    } catch (error) {
      console.log(`❌ Error fetching viewer profile: ${error.message}`);
    }
    console.log('');
    
    // Step 2: Check ADDED_USERNAME entries
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Step 2: Checking ADDED_USERNAME entries...');
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
    
    console.log(`✅ Found ${addedUsernames.length} total ADDED_USERNAME entries:\n`);
    
    const addedUsernamesPublic = new Set();
    const addedUsernamesPrivate = new Set();
    const targetUsernames = {};
    
    addedUsernames.forEach((item, index) => {
      const username = item.streamerUsername || 'MISSING';
      const visibility = item.streamerVisibility || 'public';
      const usernameLower = username.toLowerCase();
      const email = item.streamerEmail || 'MISSING';
      
      console.log(`  [${index + 1}] Username: "${username}"`);
      console.log(`      Email: ${email}`);
      console.log(`      Visibility: "${visibility}" (raw: ${JSON.stringify(item.streamerVisibility)})`);
      console.log(`      Status: ${item.status || 'MISSING'}`);
      console.log(`      Added At: ${item.addedAt || 'MISSING'}`);
      console.log(`      Auto Accepted: ${item.autoAccepted || false}`);
      
      if (visibility.toLowerCase() === 'private') {
        addedUsernamesPrivate.add(usernameLower);
        console.log(`      → Added to PRIVATE set (normalized: "${usernameLower}")`);
      } else {
        addedUsernamesPublic.add(usernameLower);
        console.log(`      → Added to PUBLIC set (normalized: "${usernameLower}")`);
      }
      
      // Check if this is one of our target usernames
      if (usernamesToCheck.some(u => u.toLowerCase() === usernameLower)) {
        targetUsernames[usernameLower] = {
          entry: item,
          visibility: visibility.toLowerCase(),
          inPublicSet: addedUsernamesPublic.has(usernameLower),
          inPrivateSet: addedUsernamesPrivate.has(usernameLower)
        };
      }
      console.log('');
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Public usernames (${addedUsernamesPublic.size}): [${Array.from(addedUsernamesPublic).join(', ')}]`);
    console.log(`   Private usernames (${addedUsernamesPrivate.size}): [${Array.from(addedUsernamesPrivate).join(', ')}]`);
    console.log('');
    
    // Step 3: Check each target username's profile and content
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const targetUsername of usernamesToCheck) {
      console.log(`\n📋 Step 3: Checking "${targetUsername}"...`);
      
      // 3a: Find user by username
      console.log(`\n   [3a] Finding user profile for "${targetUsername}"...`);
      let userEmail = null;
      let userProfile = null;
      
      // Try GSI lookup
      try {
        const gsiParams = {
          TableName: table,
          IndexName: 'UsernameSearchIndex',
          KeyConditionExpression: 'username = :username',
          ExpressionAttributeValues: {
            ':username': targetUsername
          }
        };
        const gsiResult = await dynamodb.query(gsiParams).promise();
        if (gsiResult.Items && gsiResult.Items.length > 0) {
          const profileItem = gsiResult.Items.find(item => item.SK === 'PROFILE');
          if (profileItem) {
            userEmail = profileItem.PK ? profileItem.PK.replace('USER#', '') : null;
            userProfile = profileItem;
            console.log(`   ✅ Found via GSI: email=${userEmail}, username="${userProfile.username}"`);
            console.log(`      Visibility: ${userProfile.usernameVisibility || 'public (default)'}`);
          }
        }
      } catch (error) {
        console.log(`   ⚠️ GSI lookup failed: ${error.message}`);
      }
      
      // If not found via GSI, try direct PROFILE lookup (scan)
      if (!userEmail) {
        console.log(`   🔍 GSI lookup failed, trying scan...`);
        try {
          const scanParams = {
            TableName: table,
            FilterExpression: 'SK = :sk AND username = :username',
            ExpressionAttributeValues: {
              ':sk': 'PROFILE',
              ':username': targetUsername
            },
            Limit: 5
          };
          const scanResult = await dynamodb.scan(scanParams).promise();
          if (scanResult.Items && scanResult.Items.length > 0) {
            userProfile = scanResult.Items[0];
            userEmail = userProfile.PK ? userProfile.PK.replace('USER#', '') : null;
            console.log(`   ✅ Found via scan: email=${userEmail}, username="${userProfile.username}"`);
            console.log(`      Visibility: ${userProfile.usernameVisibility || 'public (default)'}`);
          }
        } catch (error) {
          console.log(`   ❌ Scan failed: ${error.message}`);
        }
      }
      
      if (!userEmail || !userProfile) {
        console.log(`   ❌ Could not find user profile for "${targetUsername}"`);
        continue;
      }
      
      // 3b: Check if user has public content
      console.log(`\n   [3b] Checking for public content from "${targetUsername}" (${userEmail})...`);
      try {
        // Query for videos under master account (Twilly TV)
        const contentParams = {
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
            '#category': 'Videos'
          },
          Limit: 50
        };
        
        const contentResult = await dynamodb.query(contentParams).promise();
        const allVideos = contentResult.Items || [];
        
        // Filter videos by creatorUsername (check both with and without 🔒)
        const userVideos = allVideos.filter(video => {
          const creatorUsername = video.creatorUsername || '';
          const normalizedCreator = creatorUsername.toLowerCase().trim();
          const normalizedTarget = targetUsername.toLowerCase().trim();
          const isPrivate = creatorUsername.includes('🔒') || video.isPrivateUsername === true;
          
          // Check if username matches (with or without 🔒)
          const matchesUsername = normalizedCreator === normalizedTarget || 
                                 normalizedCreator.replace('🔒', '').trim() === normalizedTarget;
          
          return matchesUsername && !isPrivate; // Only public videos
        });
        
        console.log(`   ✅ Found ${userVideos.length} public videos from "${targetUsername}":`);
        userVideos.slice(0, 5).forEach((video, idx) => {
          console.log(`      [${idx + 1}] ${video.fileName || video.SK}`);
          console.log(`          creatorUsername: "${video.creatorUsername || 'NOT SET'}"`);
          console.log(`          isPrivateUsername: ${video.isPrivateUsername}`);
          console.log(`          createdAt: ${video.createdAt || 'N/A'}`);
        });
        if (userVideos.length > 5) {
          console.log(`      ... and ${userVideos.length - 5} more`);
        }
        
        // Check if username is in addedUsernamesPublic set
        const targetUsernameLower = targetUsername.toLowerCase().trim();
        const isInPublicSet = addedUsernamesPublic.has(targetUsernameLower);
        console.log(`\n   [3c] Filtering check:`);
        console.log(`      Target username (normalized): "${targetUsernameLower}"`);
        console.log(`      In addedUsernamesPublic set: ${isInPublicSet ? '✅ YES' : '❌ NO'}`);
        console.log(`      Available public usernames: [${Array.from(addedUsernamesPublic).join(', ')}]`);
        
        if (!isInPublicSet) {
          console.log(`\n   ❌ ISSUE FOUND: "${targetUsername}" is NOT in addedUsernamesPublic set!`);
          console.log(`      This means the video will be filtered out by get-content.post.js`);
          
          // Check for close matches
          const closeMatch = Array.from(addedUsernamesPublic).find(u => {
            return u.trim() === targetUsernameLower.trim() || 
                   u.replace(/\s+/g, '') === targetUsernameLower.replace(/\s+/g, '');
          });
          if (closeMatch) {
            console.log(`      ⚠️ Found close match: "${closeMatch}" (might be a normalization issue)`);
          }
        } else {
          console.log(`\n   ✅ "${targetUsername}" IS in addedUsernamesPublic set - content should show!`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error checking content: ${error.message}`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Trace complete!');
    console.log('\n📝 Summary of findings:');
    console.log(`   - Viewer email: ${viewerEmail}`);
    console.log(`   - Viewer profile username: ${viewerProfileUsername || 'NOT SET'}`);
    console.log(`   - Total ADDED_USERNAME entries: ${addedUsernames.length}`);
    console.log(`   - Public usernames in set: ${addedUsernamesPublic.size}`);
    console.log(`   - Private usernames in set: ${addedUsernamesPrivate.size}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

tracePublicUsernameIssue();
