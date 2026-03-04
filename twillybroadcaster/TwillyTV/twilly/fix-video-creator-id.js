const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixVideoCreatorId() {
  console.log('🔧 Fixing video creatorId to match stream key collaborator...\n');
  
  try {
    const streamKey = 'sk_ikgqum1e70nc4tyl';
    const adminEmail = 'dehyu.sinyan@gmail.com';
    
    // Get stream key mapping to find the collaborator's userId
    const streamKeyParams = {
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    };
    
    const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
    
    if (!streamKeyResult.Item) {
      console.log('❌ Stream key mapping not found');
      return;
    }
    
    const mapping = streamKeyResult.Item;
    const collaboratorUserId = mapping.creatorId;
    const collaboratorEmail = mapping.collaboratorEmail || mapping.ownerEmail;
    
    console.log('🔑 Stream Key Mapping:');
    console.log(`   streamKey: ${streamKey}`);
    console.log(`   collaboratorEmail: ${collaboratorEmail}`);
    console.log(`   collaboratorUserId (creatorId): ${collaboratorUserId}`);
    console.log(`   isCollaboratorKey: ${mapping.isCollaboratorKey || false}`);
    console.log('');
    
    // Find the video
    const videoParams = {
      TableName: table,
      FilterExpression: 'category = :category AND streamKey = :streamKey',
      ExpressionAttributeValues: {
        ':category': 'Videos',
        ':streamKey': streamKey
      }
    };
    
    const videoResult = await dynamodb.scan(videoParams).promise();
    
    if (!videoResult.Items || videoResult.Items.length === 0) {
      console.log('❌ No video found with stream key:', streamKey);
      return;
    }
    
    // Get the most recent video
    const videos = videoResult.Items.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return timeB - timeA;
    });
    
    const video = videos[0];
    
    console.log('📹 Video to fix:');
    console.log(`   PK: ${video.PK}`);
    console.log(`   SK: ${video.SK}`);
    console.log(`   fileName: ${video.fileName}`);
    console.log(`   Current creatorId: ${video.creatorId || 'MISSING'}`);
    console.log(`   Should be creatorId: ${collaboratorUserId}`);
    console.log('');
    
    // Check if creatorId needs to be updated
    if (video.creatorId === collaboratorUserId) {
      console.log('✅ Video already has correct creatorId');
    } else {
      console.log('🔄 Updating video creatorId...');
      
      // Update video with correct creatorId
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: video.PK,
          SK: video.SK
        },
        UpdateExpression: 'SET creatorId = :creatorId, isCollaboratorVideo = :isCollaboratorVideo',
        ExpressionAttributeValues: {
          ':creatorId': collaboratorUserId,
          ':isCollaboratorVideo': true // This is a collaborator video
        }
      }).promise();
      
      console.log('   ✅ Updated creatorId to collaborator userId');
      console.log('   ✅ Set isCollaboratorVideo to true');
    }
    
    // Verify username lookup will work
    console.log('\n👤 Verifying username lookup:');
    const profileParams = {
      TableName: table,
      Key: {
        PK: `USER#${collaboratorUserId}`,
        SK: 'PROFILE'
      }
    };
    
    const profileResult = await dynamodb.get(profileParams).promise();
    
    if (profileResult.Item) {
      console.log('   ✅ Found collaborator profile:');
      console.log(`      username: ${profileResult.Item.username || 'MISSING'}`);
      console.log(`      email: ${profileResult.Item.email || 'MISSING'}`);
      console.log(`   This username will be displayed on the channel page`);
    } else {
      console.log('   ⚠️ Collaborator profile NOT FOUND');
      console.log(`   Username lookup may fail for userId: ${collaboratorUserId}`);
      console.log(`   Email: ${collaboratorEmail}`);
    }
    
    console.log('\n✅ Fix complete!');
    console.log('   Video now has correct creatorId (collaborator userId)');
    console.log('   Username lookup will show the collaborator\'s username');
    console.log('   Video is stored under master account but shows collaborator username');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixVideoCreatorId().catch(console.error);
