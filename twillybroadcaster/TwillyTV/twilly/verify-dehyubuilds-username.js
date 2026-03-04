const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function verifyDehyubuildsUsername() {
  console.log('🔍 Verifying username and stream key connection for dehyubuilds@gmail.com...\n');
  
  try {
    const email = 'dehyubuilds@gmail.com';
    const userId = '86326e3d-af6e-4b85-b4b9-38a5695342fc';
    
    // Check ALL possible profile locations
    console.log('1️⃣ Checking profile by userId (USER#userId/PROFILE):');
    const userParams = {
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE'
      }
    };
    
    const userResult = await dynamodb.get(userParams).promise();
    
    if (userResult.Item) {
      console.log('   ✅ Found profile:');
      console.log(`      username: ${userResult.Item.username || 'MISSING'}`);
      console.log(`      email: ${userResult.Item.email || 'MISSING'}`);
    } else {
      console.log('   ❌ Profile NOT FOUND');
    }
    console.log('');
    
    // Check by email
    console.log('2️⃣ Checking profile by email (USER#email/PROFILE):');
    const emailParams = {
      TableName: table,
      Key: {
        PK: `USER#${email}`,
        SK: 'PROFILE'
      }
    };
    
    const emailResult = await dynamodb.get(emailParams).promise();
    
    if (emailResult.Item) {
      console.log('   ✅ Found profile:');
      console.log(`      username: ${emailResult.Item.username || 'MISSING'}`);
      console.log(`      email: ${emailResult.Item.email || 'MISSING'}`);
    } else {
      console.log('   ❌ Profile NOT FOUND');
    }
    console.log('');
    
    // Check stream keys for this user
    console.log('3️⃣ Checking stream keys for this user:');
    const streamKeys = [];
    let lastEvaluatedKey = null;
    
    do {
      const params = {
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND (collaboratorEmail = :email OR ownerEmail = :email OR creatorId = :userId)',
        ExpressionAttributeValues: {
          ':pkPrefix': 'STREAM_KEY#',
          ':email': email,
          ':userId': userId
        }
      };
      
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamodb.scan(params).promise();
      
      if (result.Items) {
        streamKeys.push(...result.Items);
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`   Found ${streamKeys.length} stream key(s):`);
    streamKeys.forEach((sk, index) => {
      const streamKeyValue = sk.PK.replace('STREAM_KEY#', '');
      console.log(`\n   ${index + 1}. Stream Key: ${streamKeyValue}`);
      console.log(`      creatorId: ${sk.creatorId || 'MISSING'}`);
      console.log(`      collaboratorEmail: ${sk.collaboratorEmail || 'MISSING'}`);
      console.log(`      ownerEmail: ${sk.ownerEmail || 'MISSING'}`);
      console.log(`      channelName: ${sk.channelName || sk.seriesName || 'MISSING'}`);
      console.log(`      isCollaboratorKey: ${sk.isCollaboratorKey || false}`);
      
      // Check if creatorId matches userId
      if (sk.creatorId === userId) {
        console.log(`      ✅ creatorId matches userId`);
      } else {
        console.log(`      ⚠️ creatorId does NOT match userId (expected: ${userId}, found: ${sk.creatorId || 'MISSING'})`);
      }
    });
    console.log('');
    
    // Get the current username (from either profile location)
    const currentUsername = userResult.Item?.username || emailResult.Item?.username;
    
    if (currentUsername) {
      console.log('📋 SUMMARY:');
      console.log('='.repeat(60));
      console.log(`Email: ${email}`);
      console.log(`UserId: ${userId}`);
      console.log(`Current Username: ${currentUsername}`);
      console.log(`Stream Keys Found: ${streamKeys.length}`);
      console.log('');
      
      // Verify stream keys are correctly attached
      const streamKeysWithCorrectUserId = streamKeys.filter(sk => sk.creatorId === userId);
      console.log(`Stream keys with correct creatorId (${userId}): ${streamKeysWithCorrectUserId.length}`);
      
      if (streamKeysWithCorrectUserId.length < streamKeys.length) {
        console.log(`⚠️ Some stream keys have incorrect creatorId - they need to be updated`);
      }
      
      // Check if username is valid
      const invalidUsernames = ['googoogaga', 'yess', 'dehyuusername'];
      if (invalidUsernames.includes(currentUsername.toLowerCase())) {
        console.log(`\n⚠️ WARNING: Username '${currentUsername}' is in the invalid list!`);
        console.log(`   Videos with this username will be filtered out.`);
      } else {
        console.log(`\n✅ Username '${currentUsername}' is valid.`);
      }
    } else {
      console.log('❌ No username found - account needs to set up a username');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

verifyDehyubuildsUsername().catch(console.error);
