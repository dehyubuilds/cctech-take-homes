const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function debugPOMJContent() {
  console.log('🔍 [DEBUG] Tracing POM-J content issue...\n');
  
  // Step 1: Find POM-J's email and username
  console.log('📋 Step 1: Finding POM-J user profile...');
  try {
    // Use scan to find POM-J (GSI requires usernameVisibility which we don't know)
    const searchParams = {
      TableName: table,
      FilterExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': 'POM-J'
      }
    };
    const searchResult = await dynamodb.scan(searchParams).promise();
    console.log(`   Found ${searchResult.Items?.length || 0} user(s) with username "POM-J"`);
    
    if (searchResult.Items && searchResult.Items.length > 0) {
      for (const user of searchResult.Items) {
        console.log(`   - PK: ${user.PK}, SK: ${user.SK}, email: ${user.email || user.userEmail || 'N/A'}`);
        const pomJEmail = user.email || user.userEmail || (user.PK && user.PK.startsWith('USER#') ? user.PK.replace('USER#', '') : null);
        
        if (pomJEmail) {
          console.log(`\n📋 Step 2: Checking ADDED_USERNAME entries for Twilly TV account...`);
          // Find Twilly TV email
          const twillyTVSearchParams = {
            TableName: table,
            FilterExpression: 'username = :username',
            ExpressionAttributeValues: {
              ':username': 'Twilly TV'
            }
          };
          const twillyTVResult = await dynamodb.scan(twillyTVSearchParams).promise();
          
          if (twillyTVResult.Items && twillyTVResult.Items.length > 0) {
            const twillyTVEmail = twillyTVResult.Items[0].email || twillyTVResult.Items[0].userEmail || 
                                  (twillyTVResult.Items[0].PK && twillyTVResult.Items[0].PK.startsWith('USER#') ? 
                                   twillyTVResult.Items[0].PK.replace('USER#', '') : null);
            
            if (twillyTVEmail) {
              console.log(`   Twilly TV email: ${twillyTVEmail}`);
              
              // Check ADDED_USERNAME entry
              const addedUsernameParams = {
                TableName: table,
                Key: {
                  PK: `USER#${twillyTVEmail.toLowerCase()}`,
                  SK: `ADDED_USERNAME#${pomJEmail.toLowerCase()}`
                }
              };
              const addedUsernameResult = await dynamodb.get(addedUsernameParams).promise();
              
              if (addedUsernameResult.Item) {
                console.log(`\n✅ Found ADDED_USERNAME entry:`);
                console.log(`   - streamerUsername: "${addedUsernameResult.Item.streamerUsername}"`);
                console.log(`   - streamerVisibility: "${addedUsernameResult.Item.streamerVisibility}"`);
                console.log(`   - status: "${addedUsernameResult.Item.status}"`);
                console.log(`   - streamerEmail: "${addedUsernameResult.Item.streamerEmail}"`);
              } else {
                console.log(`\n❌ NO ADDED_USERNAME entry found!`);
                console.log(`   Looking for: PK=USER#${twillyTVEmail.toLowerCase()}, SK=ADDED_USERNAME#${pomJEmail.toLowerCase()}`);
              }
              
              // Step 3: Check POM-J's PROFILE for username
              console.log(`\n📋 Step 3: Checking POM-J's PROFILE...`);
              const profileParams = {
                TableName: table,
                Key: {
                  PK: `USER#${pomJEmail.toLowerCase()}`,
                  SK: 'PROFILE'
                }
              };
              const profileResult = await dynamodb.get(profileParams).promise();
              
              if (profileResult.Item) {
                console.log(`   - username: "${profileResult.Item.username}"`);
                console.log(`   - email: "${profileResult.Item.email || pomJEmail}"`);
              } else {
                console.log(`   ❌ No PROFILE found for POM-J`);
              }
              
              // Step 4: Check POM-J's content items
              console.log(`\n📋 Step 4: Checking POM-J's content items...`);
              const contentParams = {
                TableName: table,
                IndexName: 'ChannelContentIndex',
                KeyConditionExpression: 'channelName = :channelName',
                ExpressionAttributeValues: {
                  ':channelName': 'Twilly TV'
                }
              };
              
              let allContent = [];
              let lastEvaluatedKey = null;
              do {
                if (lastEvaluatedKey) {
                  contentParams.ExclusiveStartKey = lastEvaluatedKey;
                }
                const contentResult = await dynamodb.query(contentParams).promise();
                if (contentResult.Items) {
                  allContent = allContent.concat(contentResult.Items);
                }
                lastEvaluatedKey = contentResult.LastEvaluatedKey;
              } while (lastEvaluatedKey);
              
              console.log(`   Found ${allContent.length} total content items in Twilly TV channel`);
              
              // Filter for POM-J's content
              const pomJContent = allContent.filter(item => {
                // Check if streamerEmail matches
                if (item.streamerEmail && item.streamerEmail.toLowerCase() === pomJEmail.toLowerCase()) {
                  return true;
                }
                // Check if creatorUsername matches
                if (item.creatorUsername && item.creatorUsername.toLowerCase().replace('🔒', '').trim() === 'pom-j') {
                  return true;
                }
                return false;
              });
              
              console.log(`\n📹 Found ${pomJContent.length} content items from POM-J:`);
              for (const item of pomJContent.slice(0, 5)) { // Show first 5
                console.log(`   - SK: ${item.SK}`);
                console.log(`     fileName: "${item.fileName || 'N/A'}"`);
                console.log(`     creatorUsername: "${item.creatorUsername || 'NOT SET'}"`);
                console.log(`     streamerEmail: "${item.streamerEmail || 'NOT SET'}"`);
                console.log(`     isPrivateUsername: ${item.isPrivateUsername !== undefined ? item.isPrivateUsername : 'NOT SET'}`);
                console.log(`     createdAt: ${item.createdAt || item.timestamp || 'N/A'}`);
                console.log('');
              }
              
              // Step 5: Check username lookup for content items
              console.log(`\n📋 Step 5: Checking username lookup for content items...`);
              for (const item of pomJContent.slice(0, 3)) {
                if (item.streamerEmail) {
                  // Try to find username from PROFILE
                  const itemProfileParams = {
                    TableName: table,
                    Key: {
                      PK: `USER#${item.streamerEmail.toLowerCase()}`,
                      SK: 'PROFILE'
                    }
                  };
                  const itemProfileResult = await dynamodb.get(itemProfileParams).promise();
                  
                  if (itemProfileResult.Item && itemProfileResult.Item.username) {
                    console.log(`   Item ${item.SK}:`);
                    console.log(`     - streamerEmail: ${item.streamerEmail}`);
                    console.log(`     - PROFILE.username: "${itemProfileResult.Item.username}"`);
                    console.log(`     - item.creatorUsername: "${item.creatorUsername || 'NOT SET'}"`);
                    console.log(`     - Match: ${itemProfileResult.Item.username.toLowerCase() === (item.creatorUsername || '').toLowerCase().replace('🔒', '').trim() ? '✅ YES' : '❌ NO'}`);
                  }
                }
              }
              
              // Step 6: Simulate the filtering logic
              console.log(`\n📋 Step 6: Simulating get-content filtering logic...`);
              if (addedUsernameResult.Item) {
                const addedUsername = addedUsernameResult.Item.streamerUsername?.toLowerCase().trim() || '';
                console.log(`   ADDED_USERNAME.streamerUsername (normalized): "${addedUsername}"`);
                console.log(`   streamerVisibility: "${addedUsernameResult.Item.streamerVisibility}"`);
                
                for (const item of pomJContent.slice(0, 3)) {
                  const itemUsername = (item.creatorUsername || '').toLowerCase().trim().replace('🔒', '');
                  const isPrivate = (item.creatorUsername && item.creatorUsername.includes('🔒')) || (item.isPrivateUsername === true);
                  
                  console.log(`\n   Item: ${item.SK}`);
                  console.log(`     - creatorUsername: "${item.creatorUsername || 'NOT SET'}"`);
                  console.log(`     - Normalized: "${itemUsername}"`);
                  console.log(`     - Is Private: ${isPrivate}`);
                  console.log(`     - Matches addedUsername: ${itemUsername === addedUsername ? '✅ YES' : '❌ NO'}`);
                  
                  if (addedUsernameResult.Item.streamerVisibility === 'public') {
                    if (isPrivate) {
                      console.log(`     ❌ BLOCKED: Private content but added for PUBLIC visibility`);
                    } else if (itemUsername === addedUsername) {
                      console.log(`     ✅ SHOULD SHOW: Public content from added username`);
                    } else {
                      console.log(`     ❌ BLOCKED: Username mismatch`);
                    }
                  } else {
                    console.log(`     ❌ BLOCKED: Added for private visibility, but checking public timeline`);
                  }
                }
              }
            }
          }
        }
      }
    } else {
      console.log('   ❌ No user found with username "POM-J"');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugPOMJContent().catch(console.error);
