const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function verifyUsernameSourceOfTruth() {
  console.log('🔍 Verifying username source of truth for dehyubuilds@gmail.com...\n');
  
  try {
    const email = 'dehyubuilds@gmail.com';
    const userId = '86326e3d-af6e-4b85-b4b9-38a5695342fc';
    
    // The SOURCE OF TRUTH: PK='USER', SK=userId (where update-username API stores it)
    console.log('📋 SOURCE OF TRUTH (PK=USER, SK=userId):');
    const sourceOfTruthParams = {
      TableName: table,
      Key: {
        PK: 'USER',
        SK: userId
      }
    };
    
    const sourceResult = await dynamodb.get(sourceOfTruthParams).promise();
    
    if (sourceResult.Item) {
      console.log(`   ✅ Found: username = "${sourceResult.Item.username || 'MISSING'}"`);
      console.log(`      email = "${sourceResult.Item.email || 'MISSING'}"`);
      console.log(`      updatedAt = "${sourceResult.Item.updatedAt || 'MISSING'}"`);
    } else {
      console.log('   ❌ NOT FOUND - This is the source of truth, it should exist!');
    }
    console.log('');
    
    // Check other locations (these should NOT be used as primary source)
    console.log('📋 OTHER LOCATIONS (should match source of truth or be ignored):');
    
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
      console.log(`   USER#${userId}/PROFILE: username = "${profile1Result.Item.username || 'MISSING'}"`);
      if (profile1Result.Item.username !== sourceResult.Item?.username) {
        console.log(`      ⚠️ MISMATCH with source of truth!`);
      }
    } else {
      console.log(`   USER#${userId}/PROFILE: NOT FOUND`);
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
      console.log(`   USER#${email}/PROFILE: username = "${profile2Result.Item.username || 'MISSING'}"`);
      if (profile2Result.Item.username !== sourceResult.Item?.username) {
        console.log(`      ⚠️ MISMATCH with source of truth!`);
      }
    } else {
      console.log(`   USER#${email}/PROFILE: NOT FOUND`);
    }
    
    console.log('');
    console.log('📋 SUMMARY:');
    console.log('='.repeat(60));
    const sourceUsername = sourceResult.Item?.username;
    if (sourceUsername) {
      console.log(`Source of Truth (PK=USER, SK=${userId}): "${sourceUsername}"`);
      console.log('');
      console.log('✅ This is the ONLY location that should be used for username lookup.');
      console.log('✅ When username is updated via /api/creators/update-username, it OVERWRITES this value.');
      console.log('✅ Each email/userId should have ONLY ONE username (stored here).');
    } else {
      console.log('❌ Source of truth not found - username needs to be set!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

verifyUsernameSourceOfTruth().catch(console.error);
