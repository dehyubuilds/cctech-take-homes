const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkAdminCollaboratorRole() {
  console.log('🔍 Checking admin collaborator role for Twilly TV...\n');
  
  try {
    const adminEmail = 'dehyu.sinyan@gmail.com';
    const adminUserId = 'e392bb8e-7f2a-4fc5-a96d-87544ecb3f34';
    const channelId = 'dehyu.sinyan@gmail.com-Twilly TV';
    
    console.log('Admin Info:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   UserId: ${adminUserId}`);
    console.log(`   ChannelId: ${channelId}`);
    console.log('');
    
    // Check COLLABORATOR_ROLE record
    console.log('1️⃣ Checking COLLABORATOR_ROLE record:');
    const roleParams = {
      TableName: table,
      Key: {
        PK: `USER#${adminUserId}`,
        SK: `COLLABORATOR_ROLE#${channelId}`
      }
    };
    
    const roleResult = await dynamodb.get(roleParams).promise();
    
    if (roleResult.Item) {
      console.log('   ✅ Found COLLABORATOR_ROLE record:');
      console.log(`      streamKey: ${roleResult.Item.streamKey || 'MISSING'}`);
      console.log(`      channelId: ${roleResult.Item.channelId || 'MISSING'}`);
      console.log(`      channelName: ${roleResult.Item.channelName || 'MISSING'}`);
    } else {
      console.log('   ❌ COLLABORATOR_ROLE record NOT FOUND');
      console.log('   This is why the API might be creating a new stream key!');
    }
    console.log('');
    
    // Check CHANNEL#COLLABORATOR record
    console.log('2️⃣ Checking CHANNEL#COLLABORATOR record:');
    const collabParams = {
      TableName: table,
      Key: {
        PK: `CHANNEL#${channelId}`,
        SK: `COLLABORATOR#${adminUserId}`
      }
    };
    
    const collabResult = await dynamodb.get(collabParams).promise();
    
    if (collabResult.Item) {
      console.log('   ✅ Found CHANNEL#COLLABORATOR record:');
      console.log(`      streamKey: ${collabResult.Item.streamKey || 'MISSING'}`);
      console.log(`      userId: ${collabResult.Item.userId || 'MISSING'}`);
      console.log(`      userEmail: ${collabResult.Item.userEmail || 'MISSING'}`);
    } else {
      console.log('   ❌ CHANNEL#COLLABORATOR record NOT FOUND');
    }
    console.log('');
    
    // Check stream key mapping
    console.log('3️⃣ Checking admin stream key mapping:');
    const adminStreamKey = 'sk_rrpls34e8m4t8g42';
    const streamKeyParams = {
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${adminStreamKey}`,
        SK: 'MAPPING'
      }
    };
    
    const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
    
    if (streamKeyResult.Item) {
      console.log('   ✅ Found stream key mapping:');
      const mapping = streamKeyResult.Item;
      console.log(`      streamKey: ${adminStreamKey}`);
      console.log(`      ownerEmail: ${mapping.ownerEmail || 'MISSING'}`);
      console.log(`      collaboratorEmail: ${mapping.collaboratorEmail || 'MISSING'}`);
      console.log(`      creatorId: ${mapping.creatorId || 'MISSING'}`);
      console.log(`      channelName: ${mapping.channelName || mapping.seriesName || 'MISSING'}`);
      console.log(`      isCollaboratorKey: ${mapping.isCollaboratorKey || false}`);
      
      if (mapping.creatorId !== adminUserId) {
        console.log(`   ⚠️ WARNING: creatorId mismatch!`);
        console.log(`      Expected: ${adminUserId}`);
        console.log(`      Found: ${mapping.creatorId}`);
      }
    } else {
      console.log('   ❌ Stream key mapping NOT FOUND');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkAdminCollaboratorRole().catch(console.error);
