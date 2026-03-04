const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function comprehensiveTrace() {
  console.log('🔍 [COMPREHENSIVE TRACE] Tracing entire flow...\n');
  
  const twillyTVEmail = 'dehyu.sinyan@gmail.com';
  const pomJEmail = 'pomjfitness@gmail.com';
  
  // Step 1: Check ALL ADDED_USERNAME entries
  console.log('📋 Step 1: Checking ALL ADDED_USERNAME entries for Twilly TV...');
  try {
    const params = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${twillyTVEmail.toLowerCase()}`,
        ':skPrefix': 'ADDED_USERNAME#'
      }
    };
    const result = await dynamodb.query(params).promise();
    
    console.log(`Found ${result.Items?.length || 0} ADDED_USERNAME entries:\n`);
    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        console.log(`- ${item.SK}`);
        console.log(`  streamerUsername: "${item.streamerUsername || 'NOT SET'}"`);
        console.log(`  streamerVisibility: "${item.streamerVisibility || 'NOT SET'}"`);
        console.log(`  status: "${item.status || 'NOT SET'}"`);
        console.log(`  streamerEmail: "${item.streamerEmail || 'NOT SET'}"`);
        console.log('');
      }
    } else {
      console.log('❌ NO ADDED_USERNAME entries found at all!');
      console.log('   This means the "Add" button is not creating entries.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  // Step 2: Check POM-J PROFILE
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
      console.log(`✅ POM-J PROFILE:`);
      console.log(`   username: "${profileResult.Item.username}"`);
    } else {
      console.log('❌ No PROFILE found');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  // Step 3: Find ALL content in Twilly TV channel
  console.log('\n📋 Step 3: Finding ALL content in Twilly TV channel...');
  try {
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
    
    console.log(`   Found ${allContent.length} total content items`);
    
    // Step 4: Find POM-J's content
    console.log('\n📋 Step 4: Finding POM-J content...');
    const pomJContent = allContent.filter(item => {
      if (item.streamerEmail && item.streamerEmail.toLowerCase() === pomJEmail.toLowerCase()) {
        return true;
      }
      if (item.creatorUsername) {
        const clean = item.creatorUsername.toLowerCase().replace('🔒', '').trim();
        if (clean === 'pom-j') {
          return true;
        }
      }
      return false;
    });
    
    console.log(`   Found ${pomJContent.length} items from POM-J`);
    
    if (pomJContent.length > 0) {
      console.log('\n   First 3 items:');
      for (const item of pomJContent.slice(0, 3)) {
        console.log(`   - ${item.SK}`);
        console.log(`     creatorUsername: "${item.creatorUsername || 'NOT SET'}"`);
        console.log(`     streamerEmail: "${item.streamerEmail || 'NOT SET'}"`);
        console.log(`     isPrivateUsername: ${item.isPrivateUsername !== undefined ? item.isPrivateUsername : 'NOT SET'}`);
      }
    } else {
      console.log('   ❌ NO CONTENT FROM POM-J FOUND!');
      console.log('   POM-J needs to post content to Twilly TV channel first.');
    }
    
    // Step 5: Simulate get-content.post.js filtering
    console.log('\n📋 Step 5: Simulating get-content.post.js filtering logic...');
    
    // Get all ADDED_USERNAME entries again
    const addedParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${twillyTVEmail.toLowerCase()}`,
        ':skPrefix': 'ADDED_USERNAME#',
        ':status': 'active'
      }
    };
    const addedResult = await dynamodb.query(addedParams).promise();
    
    if (addedResult.Items && addedResult.Items.length > 0) {
      const addedUsernamesPublic = new Set();
      const addedUsernamesPrivate = new Set();
      
      addedResult.Items.forEach(item => {
        if (item.streamerUsername) {
          const usernameLower = item.streamerUsername.toLowerCase();
          const visibility = item.streamerVisibility || 'public';
          
          if (visibility.toLowerCase() === 'private') {
            addedUsernamesPrivate.add(usernameLower);
          } else {
            addedUsernamesPublic.add(usernameLower);
          }
        }
      });
      
      console.log(`   Added usernames (PUBLIC): [${Array.from(addedUsernamesPublic).join(', ')}]`);
      console.log(`   Added usernames (PRIVATE): [${Array.from(addedUsernamesPrivate).join(', ')}]`);
      
      // Now check each POM-J content item
      if (pomJContent.length > 0) {
        console.log('\n   Checking POM-J content against filtering:');
        for (const item of pomJContent.slice(0, 5)) {
          const itemUsername = (item.creatorUsername || '').toLowerCase().trim().replace('🔒', '');
          const isPrivate = (item.creatorUsername && item.creatorUsername.includes('🔒')) || (item.isPrivateUsername === true);
          
          console.log(`\n   Item: ${item.SK}`);
          console.log(`     creatorUsername: "${item.creatorUsername || 'NOT SET'}"`);
          console.log(`     Normalized: "${itemUsername}"`);
          console.log(`     Is Private: ${isPrivate}`);
          
          if (isPrivate) {
            const usernameWithoutLock = itemUsername.replace('🔒', '').trim();
            const hasAddedForPrivate = addedUsernamesPrivate.has(usernameWithoutLock);
            console.log(`     Has added for PRIVATE: ${hasAddedForPrivate ? '✅ YES' : '❌ NO'}`);
            if (!hasAddedForPrivate) {
              console.log(`     ❌ BLOCKED: Private content but not added for private`);
            } else {
              console.log(`     ✅ SHOULD SHOW: Private content from added username`);
            }
          } else {
            const hasAddedForPublic = addedUsernamesPublic.has(itemUsername);
            console.log(`     Has added for PUBLIC: ${hasAddedForPublic ? '✅ YES' : '❌ NO'}`);
            if (!hasAddedForPublic) {
              console.log(`     ❌ BLOCKED: Not in addedUsernamesPublic set`);
              console.log(`        Looking for: "${itemUsername}"`);
              console.log(`        Available: [${Array.from(addedUsernamesPublic).join(', ')}]`);
            } else {
              console.log(`     ✅ SHOULD SHOW: Public content from added username`);
            }
          }
        }
      }
    } else {
      console.log('   ❌ No ADDED_USERNAME entries found - cannot filter content');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

comprehensiveTrace().catch(console.error);
