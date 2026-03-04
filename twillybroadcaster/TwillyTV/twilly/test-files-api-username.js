const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function testFilesAPIUsernameLookup() {
  const masterEmail = 'dehyu.sinyan@gmail.com';
  const streamKey = 'sk_grjnembh56nw87yl';
  const creatorId = 'f6ff9d4d-fb19-425c-94cb-617a9ee6f7fc';
  const targetUsername = 'dehswizzy';
  
  console.log(`🔍 Testing username lookup as /api/files/[userId] would do it...\n`);
  
  // Step 1: Get the file
  const result = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${masterEmail}`,
      ':skPrefix': 'FILE#'
    }
  }).promise();
  
  const file = (result.Items || []).find(f => f.streamKey === streamKey);
  
  if (!file) {
    console.log(`❌ File not found with streamKey: ${streamKey}`);
    return;
  }
  
  console.log(`✅ Found file:`);
  console.log(`   SK: ${file.SK}`);
  console.log(`   fileName: ${file.fileName}`);
  console.log(`   streamKey: ${file.streamKey}`);
  console.log(`   creatorId: ${file.creatorId || 'N/A'}`);
  console.log(`   isVisible: ${file.isVisible}`);
  console.log(`   hlsUrl: ${file.hlsUrl ? 'PRESENT' : 'MISSING'}`);
  console.log(`   thumbnailUrl: ${file.thumbnailUrl ? 'PRESENT' : 'MISSING'}`);
  
  // Step 2: Simulate the NEW username lookup logic (after my fix)
  console.log(`\n📋 Simulating NEW username lookup logic (after fix)...`);
  let username = null;
  
  // PRIORITY 1: SOURCE OF TRUTH
  if (file.creatorId) {
    try {
      const sourceOfTruthParams = {
        TableName: 'Twilly',
        Key: {
          PK: 'USER',
          SK: file.creatorId
        }
      };
      const sourceResult = await dynamodb.get(sourceOfTruthParams).promise();
      if (sourceResult.Item && sourceResult.Item.username) {
        username = sourceResult.Item.username;
        console.log(`✅ PRIORITY 1 (SOURCE OF TRUTH): Found username "${username}"`);
      } else {
        console.log(`❌ PRIORITY 1 (SOURCE OF TRUTH): No username found`);
      }
    } catch (err) {
      console.log(`❌ PRIORITY 1 (SOURCE OF TRUTH): Error - ${err.message}`);
    }
  }
  
  // PRIORITY 2: Fallback
  if (!username && file.creatorId) {
    try {
      const userParams = {
        TableName: 'Twilly',
        Key: {
          PK: `USER#${file.creatorId}`,
          SK: 'PROFILE'
        }
      };
      const userResult = await dynamodb.get(userParams).promise();
      if (userResult.Item && userResult.Item.username) {
        username = userResult.Item.username;
        console.log(`⚠️ PRIORITY 2 (Fallback): Found username "${username}" (should use SOURCE OF TRUTH instead)`);
      } else {
        console.log(`❌ PRIORITY 2 (Fallback): No username found`);
      }
    } catch (err) {
      console.log(`❌ PRIORITY 2 (Fallback): Error - ${err.message}`);
    }
  }
  
  // PRIORITY 3: StreamKey mapping
  if (!username && file.streamKey) {
    try {
      const streamKeyParams = {
        TableName: 'Twilly',
        Key: {
          PK: `STREAM_KEY#${file.streamKey}`,
          SK: 'MAPPING'
        }
      };
      const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
      if (streamKeyResult.Item && streamKeyResult.Item.creatorId) {
        // Try SOURCE OF TRUTH first
        try {
          const sourceOfTruthParams = {
            TableName: 'Twilly',
            Key: {
              PK: 'USER',
              SK: streamKeyResult.Item.creatorId
            }
          };
          const sourceResult = await dynamodb.get(sourceOfTruthParams).promise();
          if (sourceResult.Item && sourceResult.Item.username) {
            username = sourceResult.Item.username;
            console.log(`✅ PRIORITY 3 (StreamKey -> SOURCE OF TRUTH): Found username "${username}"`);
          }
        } catch (err) {
          // Fallback
          const userParams = {
            TableName: 'Twilly',
            Key: {
              PK: `USER#${streamKeyResult.Item.creatorId}`,
              SK: 'PROFILE'
            }
          };
          const userResult = await dynamodb.get(userParams).promise();
          if (userResult.Item && userResult.Item.username) {
            username = userResult.Item.username;
            console.log(`⚠️ PRIORITY 3 (StreamKey -> Fallback): Found username "${username}"`);
          }
        }
      }
    } catch (err) {
      console.log(`❌ PRIORITY 3 (StreamKey): Error - ${err.message}`);
    }
  }
  
  console.log(`\n📊 Final Result:`);
  console.log(`   Username found: ${username || 'NONE'}`);
  
  if (username) {
    file.creatorUsername = username;
    console.log(`   File will have creatorUsername: "${file.creatorUsername}"`);
    
    // Check if it would be filtered
    const invalidUsernames = ['googoogaga', 'yess'];
    const hasInvalidUsername = invalidUsernames.includes(username.toLowerCase());
    
    console.log(`\n   Filtering Check:`);
    console.log(`     Is username invalid? ${hasInvalidUsername ? '❌ YES' : '✅ NO'}`);
    
    if (hasInvalidUsername) {
      console.log(`     ❌ Video would be FILTERED OUT in managefiles.vue`);
    } else {
      console.log(`     ✅ Video would NOT be filtered in managefiles.vue`);
      
      // Check other filtering criteria
      const hasHlsUrl = !!file.hlsUrl;
      const hasStreamKey = !!file.streamKey;
      const isVisible = file.isVisible === true;
      
      // Thumbnail check
      const thumbnailUrl = file.thumbnailUrl;
      let hasValidThumbnail = false;
      
      if (thumbnailUrl) {
        if (typeof thumbnailUrl === 'string') {
          const trimmed = thumbnailUrl.trim();
          if (trimmed !== '' && 
              trimmed !== 'null' && 
              trimmed !== 'undefined' &&
              trimmed !== 'None' &&
              trimmed !== 'none' &&
              !trimmed.startsWith('data:') &&
              (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
            try {
              const url = new URL(trimmed);
              if (url.hostname && url.pathname) {
                hasValidThumbnail = true;
              }
            } catch (e) {
              hasValidThumbnail = false;
            }
          }
        }
      }
      
      const folderMatch = true; // Assuming Twilly TV
      
      const wouldShow = hasHlsUrl && hasStreamKey && isVisible && hasValidThumbnail && folderMatch;
      
      console.log(`\n     Other Filtering Criteria:`);
      console.log(`       hasHlsUrl: ${hasHlsUrl ? '✅' : '❌'}`);
      console.log(`       hasStreamKey: ${hasStreamKey ? '✅' : '❌'}`);
      console.log(`       isVisible: ${isVisible ? '✅' : '❌'}`);
      console.log(`       hasValidThumbnail: ${hasValidThumbnail ? '✅' : '❌'}`);
      console.log(`       folderMatch: ${folderMatch ? '✅' : '❌'}`);
      console.log(`\n     Final Result: ${wouldShow ? '✅ WOULD SHOW' : '❌ WOULD NOT SHOW'}`);
    }
  } else {
    console.log(`   ⚠️ No username found - file.creatorUsername will be undefined`);
    console.log(`   This means it would NOT be filtered (only filters if username exists and is invalid)`);
  }
}

testFilesAPIUsernameLookup().catch(console.error);
