const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function tracePOMJIssue() {
  console.log('🔍 [TRACE] Tracing POM-J content issue from start to finish...\n');
  
  const twillyTVEmail = 'dehyu.sinyan@gmail.com';
  const pomJEmail = 'pomjfitness@gmail.com';
  
  // Step 1: Check ADDED_USERNAME entry
  console.log('📋 Step 1: Checking ADDED_USERNAME entry...');
  try {
    const addedParams = {
      TableName: table,
      Key: {
        PK: `USER#${twillyTVEmail.toLowerCase()}`,
        SK: `ADDED_USERNAME#${pomJEmail.toLowerCase()}`
      }
    };
    const addedResult = await dynamodb.get(addedParams).promise();
    
    if (addedResult.Item) {
      console.log('✅ ADDED_USERNAME entry EXISTS:');
      console.log(JSON.stringify(addedResult.Item, null, 2));
      console.log(`   streamerUsername: "${addedResult.Item.streamerUsername}"`);
      console.log(`   streamerVisibility: "${addedResult.Item.streamerVisibility}"`);
      console.log(`   status: "${addedResult.Item.status}"`);
    } else {
      console.log('❌ NO ADDED_USERNAME entry found!');
      console.log(`   Looking for: PK=USER#${twillyTVEmail.toLowerCase()}, SK=ADDED_USERNAME#${pomJEmail.toLowerCase()}`);
      return; // Can't continue if entry doesn't exist
    }
  } catch (error) {
    console.error('❌ Error checking ADDED_USERNAME:', error);
    return;
  }
  
  // Step 2: Check POM-J's PROFILE
  console.log('\n📋 Step 2: Checking POM-J PROFILE...');
  try {
    const profileParams = {
      TableName: table,
      Key: {
        PK: `USER#${pomJEmail.toLowerCase()}`,
        SK: 'PROFILE'
      }
    };
    const profileResult = await dynamodb.get(profileParams).promise();
    
    if (profileResult.Item) {
      console.log('✅ POM-J PROFILE:');
      console.log(`   username: "${profileResult.Item.username}"`);
      console.log(`   usernameVisibility: "${profileResult.Item.usernameVisibility || 'NOT SET'}"`);
    } else {
      console.log('❌ No PROFILE found for POM-J');
    }
  } catch (error) {
    console.error('❌ Error checking PROFILE:', error);
  }
  
  // Step 3: Find POM-J's content items
  console.log('\n📋 Step 3: Finding POM-J content items...');
  try {
    // Query all content for Twilly TV channel
    const contentParams = {
      TableName: table,
      FilterExpression: 'channelName = :channelName',
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
      const contentResult = await dynamodb.scan(contentParams).promise();
      if (contentResult.Items) {
        allContent = allContent.concat(contentResult.Items);
      }
      lastEvaluatedKey = contentResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`   Found ${allContent.length} total content items in Twilly TV channel`);
    
    // Filter for POM-J's content
    const pomJContent = allContent.filter(item => {
      // Check streamerEmail
      if (item.streamerEmail && item.streamerEmail.toLowerCase() === pomJEmail.toLowerCase()) {
        return true;
      }
      // Check creatorUsername
      if (item.creatorUsername) {
        const cleanUsername = item.creatorUsername.toLowerCase().replace('🔒', '').trim();
        if (cleanUsername === 'pom-j') {
          return true;
        }
      }
      return false;
    });
    
    console.log(`\n📹 Found ${pomJContent.length} content items from POM-J:`);
    if (pomJContent.length === 0) {
      console.log('   ❌ NO CONTENT FOUND - This is the problem!');
      console.log('   POM-J needs to have posted content to Twilly TV channel');
      return;
    }
    
    // Show first 5 items
    for (const item of pomJContent.slice(0, 5)) {
      console.log(`\n   Item: ${item.SK}`);
      console.log(`     fileName: "${item.fileName || 'N/A'}"`);
      console.log(`     creatorUsername: "${item.creatorUsername || 'NOT SET'}"`);
      console.log(`     streamerEmail: "${item.streamerEmail || 'NOT SET'}"`);
      console.log(`     isPrivateUsername: ${item.isPrivateUsername !== undefined ? item.isPrivateUsername : 'NOT SET'}`);
      console.log(`     createdAt: ${item.createdAt || item.timestamp || 'N/A'}`);
    }
  } catch (error) {
    console.error('❌ Error finding content:', error);
  }
  
  // Step 4: Simulate get-content.post.js filtering logic
  console.log('\n📋 Step 4: Simulating get-content.post.js filtering logic...');
  try {
    // Get ADDED_USERNAME entry again
    const addedParams = {
      TableName: table,
      Key: {
        PK: `USER#${twillyTVEmail.toLowerCase()}`,
        SK: `ADDED_USERNAME#${pomJEmail.toLowerCase()}`
      }
    };
    const addedResult = await dynamodb.get(addedParams).promise();
    
    if (!addedResult.Item) {
      console.log('❌ Cannot simulate - ADDED_USERNAME entry not found');
      return;
    }
    
    const addedUsername = addedResult.Item.streamerUsername?.toLowerCase().trim() || '';
    const addedVisibility = addedResult.Item.streamerVisibility || 'public';
    
    console.log(`   ADDED_USERNAME.streamerUsername (normalized): "${addedUsername}"`);
    console.log(`   ADDED_USERNAME.streamerVisibility: "${addedVisibility}"`);
    
    // Get POM-J content again
    const contentParams = {
      TableName: table,
      FilterExpression: 'channelName = :channelName',
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
      const contentResult = await dynamodb.scan(contentParams).promise();
      if (contentResult.Items) {
        allContent = allContent.concat(contentResult.Items);
      }
      lastEvaluatedKey = contentResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    const pomJContent = allContent.filter(item => {
      if (item.streamerEmail && item.streamerEmail.toLowerCase() === pomJEmail.toLowerCase()) {
        return true;
      }
      if (item.creatorUsername) {
        const cleanUsername = item.creatorUsername.toLowerCase().replace('🔒', '').trim();
        if (cleanUsername === 'pom-j') {
          return true;
        }
      }
      return false;
    });
    
    console.log(`\n   Checking ${pomJContent.length} POM-J content items against filtering logic:\n`);
    
    for (const item of pomJContent.slice(0, 5)) {
      const itemUsername = (item.creatorUsername || '').toLowerCase().trim().replace('🔒', '');
      const isPrivate = (item.creatorUsername && item.creatorUsername.includes('🔒')) || (item.isPrivateUsername === true);
      
      console.log(`   Item: ${item.SK}`);
      console.log(`     creatorUsername: "${item.creatorUsername || 'NOT SET'}"`);
      console.log(`     Normalized username: "${itemUsername}"`);
      console.log(`     Is Private: ${isPrivate}`);
      console.log(`     Matches addedUsername: ${itemUsername === addedUsername ? '✅ YES' : '❌ NO'}`);
      
      // Simulate the filtering logic from get-content.post.js
      if (isPrivate) {
        console.log(`     ❌ BLOCKED: Private content (should only show if added for PRIVATE visibility)`);
      } else {
        // Public content
        if (addedVisibility === 'public') {
          if (itemUsername === addedUsername) {
            console.log(`     ✅ SHOULD SHOW: Public content from added username`);
          } else {
            console.log(`     ❌ BLOCKED: Username mismatch`);
            console.log(`        Item username: "${itemUsername}"`);
            console.log(`        Added username: "${addedUsername}"`);
          }
        } else {
          console.log(`     ❌ BLOCKED: Added for private visibility, but checking public timeline`);
        }
      }
      console.log('');
    }
    
    // Step 5: Check username lookup for content items
    console.log('\n📋 Step 5: Checking username lookup for content items...');
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
          const profileUsername = itemProfileResult.Item.username.toLowerCase();
          const itemUsername = (item.creatorUsername || '').toLowerCase().replace('🔒', '').trim();
          
          console.log(`   Item ${item.SK}:`);
          console.log(`     streamerEmail: ${item.streamerEmail}`);
          console.log(`     PROFILE.username: "${itemProfileResult.Item.username}"`);
          console.log(`     item.creatorUsername: "${item.creatorUsername || 'NOT SET'}"`);
          console.log(`     Match: ${profileUsername === itemUsername ? '✅ YES' : '❌ NO'}`);
          if (profileUsername !== itemUsername) {
            console.log(`     ⚠️ ISSUE: creatorUsername doesn't match PROFILE.username!`);
            console.log(`        This could cause filtering to fail`);
          }
        } else {
          console.log(`   Item ${item.SK}: No PROFILE found for ${item.streamerEmail}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error simulating filtering:', error);
  }
}

tracePOMJIssue().catch(console.error);
