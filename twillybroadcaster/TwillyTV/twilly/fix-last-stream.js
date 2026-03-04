const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixLastStream() {
  console.log('🔧 Fixing the last stream to be stored under admin account...\n');
  
  try {
    const adminEmail = 'dehyu.sinyan@gmail.com';
    const adminUserId = 'e392bb8e-7f2a-4fc5-a96d-87544ecb3f34'; // Admin's userId from stream key mapping
    const problematicStreamKey = 'sk_ikgqum1e70nc4tyl';
    const correctStreamKey = 'sk_rrpls34e8m4t8g42'; // Admin's correct stream key
    
    // Find the video
    const videoParams = {
      TableName: table,
      FilterExpression: 'category = :category AND streamKey = :streamKey',
      ExpressionAttributeValues: {
        ':category': 'Videos',
        ':streamKey': problematicStreamKey
      }
    };
    
    const videoResult = await dynamodb.scan(videoParams).promise();
    
    if (!videoResult.Items || videoResult.Items.length === 0) {
      console.log('❌ No video found with stream key:', problematicStreamKey);
      return;
    }
    
    // Get the most recent video
    const videos = videoResult.Items.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return timeB - timeA;
    });
    
    const video = videos[0];
    
    console.log('📹 Found video to fix:');
    console.log(`   PK: ${video.PK}`);
    console.log(`   SK: ${video.SK}`);
    console.log(`   fileName: ${video.fileName}`);
    console.log(`   Currently stored under: ${video.PK.replace('USER#', '')}`);
    console.log(`   Should be stored under: ${adminEmail}`);
    console.log('');
    
    // Check if video is already under admin account
    if (video.PK === `USER#${adminEmail}`) {
      console.log('✅ Video is already stored under admin account');
    } else {
      console.log('🔄 Moving video to admin account...');
      
      // Create new video entry under admin account
      const newVideoItem = {
        ...video,
        PK: `USER#${adminEmail}`,
        // Keep the same SK (fileId) to maintain uniqueness
        creatorId: adminUserId, // Add admin's userId as creatorId
        isCollaboratorVideo: false, // Admin owns the channel, not a collaborator
      };
      
      // Delete old entry
      await dynamodb.delete({
        TableName: table,
        Key: {
          PK: video.PK,
          SK: video.SK
        }
      }).promise();
      
      console.log('   ✅ Deleted old video entry');
      
      // Create new entry under admin account
      await dynamodb.put({
        TableName: table,
        Item: newVideoItem
      }).promise();
      
      console.log('   ✅ Created new video entry under admin account');
    }
    
    // Update video to add creatorId if missing
    if (!video.creatorId) {
      console.log('🔄 Adding creatorId to video...');
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: `USER#${adminEmail}`,
          SK: video.SK
        },
        UpdateExpression: 'SET creatorId = :creatorId, isCollaboratorVideo = :isCollaboratorVideo',
        ExpressionAttributeValues: {
          ':creatorId': adminUserId,
          ':isCollaboratorVideo': false
        }
      }).promise();
      
      console.log('   ✅ Added creatorId to video');
    }
    
    // Update stream key mapping to point to admin (if it's the problematic key)
    console.log('🔄 Checking stream key mapping...');
    const streamKeyParams = {
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${problematicStreamKey}`,
        SK: 'MAPPING'
      }
    };
    
    const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
    
    if (streamKeyResult.Item) {
      const mapping = streamKeyResult.Item;
      if (mapping.collaboratorEmail !== adminEmail) {
        console.log('   ⚠️ Stream key mapping points to wrong user:');
        console.log(`      Current: ${mapping.collaboratorEmail || mapping.ownerEmail}`);
        console.log(`      Should be: ${adminEmail}`);
        console.log('   💡 Note: This stream key belongs to another user, so we won\'t change it');
        console.log('   💡 Admin should use their own stream key: ' + correctStreamKey);
      }
    }
    
    console.log('\n✅ Fix complete!');
    console.log('   Video is now stored under admin account');
    console.log('   Video has creatorId for username lookup');
    console.log('   Video should now appear in admin account');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixLastStream().catch(console.error);
