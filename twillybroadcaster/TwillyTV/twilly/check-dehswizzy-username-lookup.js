const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkUsernameLookup() {
  const streamKey = 'sk_grjnembh56nw87yl';
  const creatorId = 'f6ff9d4d-fb19-425c-94cb-617a9ee6f7fc';
  const targetUsername = 'dehswizzy';
  
  console.log(`🔍 Checking username lookup for streamKey: ${streamKey}\n`);
  console.log(`   creatorId: ${creatorId}\n`);
  
  // Step 1: Get streamKey mapping
  const streamKeyParams = {
    TableName: table,
    Key: {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING'
    }
  };
  const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
  
  if (streamKeyResult.Item) {
    console.log(`✅ StreamKey mapping found:`);
    console.log(`   creatorId: ${streamKeyResult.Item.creatorId || 'N/A'}`);
    console.log(`   username: ${streamKeyResult.Item.username || 'N/A'}`);
    console.log(`   collaboratorEmail: ${streamKeyResult.Item.collaboratorEmail || 'N/A'}`);
  }
  
  // Step 2: Try to get username from SOURCE OF TRUTH (PK='USER', SK=userId)
  console.log(`\n📋 Step 2: Looking up username from SOURCE OF TRUTH (PK='USER', SK=${creatorId})...`);
  try {
    const sourceOfTruthParams = {
      TableName: table,
      Key: {
        PK: 'USER',
        SK: creatorId
      }
    };
    const sourceResult = await dynamodb.get(sourceOfTruthParams).promise();
    if (sourceResult.Item && sourceResult.Item.username) {
      const username = sourceResult.Item.username;
      console.log(`✅ Found username from SOURCE OF TRUTH: "${username}"`);
      
      // Check if this username would be filtered
      const invalidUsernames = ['googoogaga', 'yess'];
      const isInvalid = invalidUsernames.includes(username.toLowerCase());
      console.log(`   Would be filtered: ${isInvalid ? '❌ YES (invalid username)' : '✅ NO'}`);
      
      if (username.toLowerCase() === targetUsername.toLowerCase()) {
        console.log(`   ✅ This matches target username "${targetUsername}"`);
      }
    } else {
      console.log(`❌ No username found in SOURCE OF TRUTH`);
    }
  } catch (err) {
    console.log(`❌ Error with source of truth lookup: ${err.message}`);
  }
  
  // Step 3: Try USER#userId/PROFILE (fallback)
  console.log(`\n📋 Step 3: Looking up username from USER#${creatorId}/PROFILE (fallback)...`);
  try {
    const userParams = {
      TableName: table,
      Key: {
        PK: `USER#${creatorId}`,
        SK: 'PROFILE'
      }
    };
    const userResult = await dynamodb.get(userParams).promise();
    if (userResult.Item && userResult.Item.username) {
      const username = userResult.Item.username;
      console.log(`✅ Found username from fallback: "${username}"`);
      
      // Check if this username would be filtered
      const invalidUsernames = ['googoogaga', 'yess'];
      const isInvalid = invalidUsernames.includes(username.toLowerCase());
      console.log(`   Would be filtered: ${isInvalid ? '❌ YES (invalid username)' : '✅ NO'}`);
    } else {
      console.log(`❌ No username found in fallback location`);
    }
  } catch (err) {
    console.log(`❌ Error with fallback lookup: ${err.message}`);
  }
  
  // Step 4: Check what the web app's /api/files/[userId] endpoint would return
  console.log(`\n📋 Step 4: Simulating web app username lookup (from /api/files/[userId])...`);
  try {
    // The web app looks up username from creatorId
    const webAppUserParams = {
      TableName: table,
      Key: {
        PK: `USER#${creatorId}`,
        SK: 'PROFILE'
      }
    };
    const webAppUserResult = await dynamodb.get(webAppUserParams).promise();
    if (webAppUserResult.Item && webAppUserResult.Item.username) {
      const username = webAppUserResult.Item.username;
      console.log(`✅ Web app would find username: "${username}"`);
      
      // Check if this username would be filtered in managefiles.vue
      const invalidUsernames = ['googoogaga', 'yess'];
      const hasInvalidUsername = invalidUsernames.includes(username.toLowerCase());
      
      if (hasInvalidUsername) {
        console.log(`   ❌ This username would be FILTERED OUT in managefiles.vue`);
      } else {
        console.log(`   ✅ This username would NOT be filtered in managefiles.vue`);
      }
    } else {
      console.log(`❌ Web app would NOT find username (no USER#${creatorId}/PROFILE)`);
      console.log(`   This means creatorUsername would be undefined/null`);
      console.log(`   managefiles.vue would NOT filter it out (only filters if username exists and is invalid)`);
    }
  } catch (err) {
    console.log(`❌ Error with web app lookup: ${err.message}`);
  }
  
  // Step 5: Check what the mobile app's get-content API would return
  console.log(`\n📋 Step 5: Simulating mobile app username lookup (from get-content API)...`);
  try {
    // Mobile app uses the same logic - try SOURCE OF TRUTH first
    const mobileSourceParams = {
      TableName: table,
      Key: {
        PK: 'USER',
        SK: creatorId
      }
    };
    const mobileSourceResult = await dynamodb.get(mobileSourceParams).promise();
    
    let mobileUsername = null;
    if (mobileSourceResult.Item && mobileSourceResult.Item.username) {
      mobileUsername = mobileSourceResult.Item.username;
      console.log(`✅ Mobile app would find username from SOURCE OF TRUTH: "${mobileUsername}"`);
    } else {
      // Try fallback
      const mobileFallbackParams = {
        TableName: table,
        Key: {
          PK: `USER#${creatorId}`,
          SK: 'PROFILE'
        }
      };
      const mobileFallbackResult = await dynamodb.get(mobileFallbackParams).promise();
      if (mobileFallbackResult.Item && mobileFallbackResult.Item.username) {
        mobileUsername = mobileFallbackResult.Item.username;
        console.log(`✅ Mobile app would find username from fallback: "${mobileUsername}"`);
      } else {
        console.log(`❌ Mobile app would NOT find username`);
      }
    }
    
    if (mobileUsername) {
      // Check if this username would be filtered in get-content API
      const invalidUsernames = ['googoogaga', 'yess'];
      const isInvalid = invalidUsernames.includes(mobileUsername.toLowerCase());
      
      if (isInvalid) {
        console.log(`   ❌ This username would be FILTERED OUT in get-content API`);
      } else {
        console.log(`   ✅ This username would NOT be filtered in get-content API`);
      }
    } else {
      console.log(`   ✅ No username found, so it would NOT be filtered (only filters if username exists and is invalid)`);
    }
  } catch (err) {
    console.log(`❌ Error with mobile app lookup: ${err.message}`);
  }
  
  // Step 6: Check if "dehswizzy" is in the invalid usernames list
  console.log(`\n📋 Step 6: Checking if "${targetUsername}" is in invalid usernames list...`);
  const invalidUsernames = ['googoogaga', 'yess'];
  const isDehswizzyInvalid = invalidUsernames.includes(targetUsername.toLowerCase());
  console.log(`   Invalid usernames list: ${JSON.stringify(invalidUsernames)}`);
  console.log(`   Is "${targetUsername}" invalid? ${isDehswizzyInvalid ? '❌ YES' : '✅ NO'}`);
  
  if (isDehswizzyInvalid) {
    console.log(`\n   ⚠️ ISSUE FOUND: "${targetUsername}" is in the invalid usernames list!`);
    console.log(`   This would cause the video to be filtered out in both web and mobile.`);
  } else {
    console.log(`\n   ✅ "${targetUsername}" is NOT in the invalid usernames list.`);
    console.log(`   So username filtering should NOT be the issue.`);
  }
}

checkUsernameLookup().catch(console.error);
