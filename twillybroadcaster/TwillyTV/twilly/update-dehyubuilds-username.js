const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function updateDehyubuildsUsername() {
  console.log('🔧 Updating username for dehyubuilds@gmail.com to "dehyuusername"...\n');
  
  try {
    const email = 'dehyubuilds@gmail.com';
    const userId = '86326e3d-af6e-4b85-b4b9-38a5695342fc';
    const newUsername = 'dehyuusername';
    
    // Check all possible profile locations
    console.log('1️⃣ Checking existing profiles:');
    
    // Location 1: USER#userId/PROFILE
    const profile1Params = {
      TableName: table,
      Key: {
        PK: `USER#${userId}`,
        SK: 'PROFILE'
      }
    };
    const profile1Result = await dynamodb.get(profile1Params).promise();
    
    if (profile1Result.Item) {
      console.log(`   ✅ Found USER#${userId}/PROFILE`);
      console.log(`      Current username: ${profile1Result.Item.username || 'MISSING'}`);
    } else {
      console.log(`   ❌ USER#${userId}/PROFILE NOT FOUND`);
    }
    
    // Location 2: USER#email/PROFILE
    const profile2Params = {
      TableName: table,
      Key: {
        PK: `USER#${email}`,
        SK: 'PROFILE'
      }
    };
    const profile2Result = await dynamodb.get(profile2Params).promise();
    
    if (profile2Result.Item) {
      console.log(`   ✅ Found USER#${email}/PROFILE`);
      console.log(`      Current username: ${profile2Result.Item.username || 'MISSING'}`);
    } else {
      console.log(`   ❌ USER#${email}/PROFILE NOT FOUND`);
    }
    
    // Location 3: USER/userId (from update-username API)
    const profile3Params = {
      TableName: table,
      Key: {
        PK: 'USER',
        SK: userId
      }
    };
    const profile3Result = await dynamodb.get(profile3Params).promise();
    
    if (profile3Result.Item) {
      console.log(`   ✅ Found USER/${userId}`);
      console.log(`      Current username: ${profile3Result.Item.username || 'MISSING'}`);
    } else {
      console.log(`   ❌ USER/${userId} NOT FOUND`);
    }
    
    console.log('');
    
    // Update all profile locations to ensure consistency
    console.log('2️⃣ Updating username in all profile locations:');
    
    // Update Location 1: USER#userId/PROFILE
    if (profile1Result.Item) {
      try {
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `USER#${userId}`,
            SK: 'PROFILE'
          },
          UpdateExpression: 'SET username = :username, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':username': newUsername,
            ':updatedAt': new Date().toISOString()
          }
        }).promise();
        console.log(`   ✅ Updated USER#${userId}/PROFILE`);
      } catch (error) {
        console.log(`   ❌ Failed to update USER#${userId}/PROFILE: ${error.message}`);
      }
    } else {
      // Create if doesn't exist
      try {
        await dynamodb.put({
          TableName: table,
          Item: {
            PK: `USER#${userId}`,
            SK: 'PROFILE',
            username: newUsername,
            email: email,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }).promise();
        console.log(`   ✅ Created USER#${userId}/PROFILE with username`);
      } catch (error) {
        console.log(`   ❌ Failed to create USER#${userId}/PROFILE: ${error.message}`);
      }
    }
    
    // Update Location 2: USER#email/PROFILE
    if (profile2Result.Item) {
      try {
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: `USER#${email}`,
            SK: 'PROFILE'
          },
          UpdateExpression: 'SET username = :username, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':username': newUsername,
            ':updatedAt': new Date().toISOString()
          }
        }).promise();
        console.log(`   ✅ Updated USER#${email}/PROFILE`);
      } catch (error) {
        console.log(`   ❌ Failed to update USER#${email}/PROFILE: ${error.message}`);
      }
    } else {
      // Create if doesn't exist
      try {
        await dynamodb.put({
          TableName: table,
          Item: {
            PK: `USER#${email}`,
            SK: 'PROFILE',
            username: newUsername,
            email: email,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }).promise();
        console.log(`   ✅ Created USER#${email}/PROFILE with username`);
      } catch (error) {
        console.log(`   ❌ Failed to create USER#${email}/PROFILE: ${error.message}`);
      }
    }
    
    // Update Location 3: USER/userId (from update-username API)
    if (profile3Result.Item) {
      try {
        await dynamodb.update({
          TableName: table,
          Key: {
            PK: 'USER',
            SK: userId
          },
          UpdateExpression: 'SET username = :username, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':username': newUsername,
            ':updatedAt': new Date().toISOString()
          }
        }).promise();
        console.log(`   ✅ Updated USER/${userId}`);
      } catch (error) {
        console.log(`   ❌ Failed to update USER/${userId}: ${error.message}`);
      }
    } else {
      // Create if doesn't exist
      try {
        await dynamodb.put({
          TableName: table,
          Item: {
            PK: 'USER',
            SK: userId,
            username: newUsername,
            email: email,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }).promise();
        console.log(`   ✅ Created USER/${userId} with username`);
      } catch (error) {
        console.log(`   ❌ Failed to create USER/${userId}: ${error.message}`);
      }
    }
    
    console.log('');
    console.log('✅ Username update complete!');
    console.log(`   Email: ${email}`);
    console.log(`   UserId: ${userId}`);
    console.log(`   Username: ${newUsername}`);
    console.log('');
    console.log('📋 Note: Stream keys will now attach to this username when videos are streamed.');
    console.log('   The username lookup in get-content API will use this value.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

updateDehyubuildsUsername().catch(console.error);
