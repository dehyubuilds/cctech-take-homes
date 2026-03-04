const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function investigateLastStream() {
  console.log('🔍 Investigating the last stream...\n');
  
  try {
    // Find the most recent video in Twilly TV channel
    const videos = [];
    let lastEvaluatedKey = null;
    
    do {
      const params = {
        TableName: table,
        FilterExpression: 'category = :category AND (folderName = :channelName OR seriesName = :channelName)',
        ExpressionAttributeValues: {
          ':category': 'Videos',
          ':channelName': 'Twilly TV'
        }
      };
      
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamodb.scan(params).promise();
      
      if (result.Items) {
        videos.push(...result.Items);
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`Found ${videos.length} total videos in Twilly TV channel\n`);
    
    // Sort by timestamp/createdAt (newest first)
    videos.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
      const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
      return timeB - timeA;
    });
    
    if (videos.length === 0) {
      console.log('❌ No videos found in Twilly TV channel');
      return;
    }
    
    // Get the most recent video
    const latestVideo = videos[0];
    
    console.log('📹 MOST RECENT VIDEO:');
    console.log('='.repeat(60));
    console.log(`PK: ${latestVideo.PK}`);
    console.log(`SK: ${latestVideo.SK}`);
    console.log(`fileName: ${latestVideo.fileName || 'MISSING'}`);
    console.log(`streamKey: ${latestVideo.streamKey || 'MISSING'}`);
    console.log(`folderName: ${latestVideo.folderName || 'MISSING'}`);
    console.log(`seriesName: ${latestVideo.seriesName || 'MISSING'}`);
    console.log(`createdAt: ${latestVideo.createdAt || latestVideo.timestamp || 'MISSING'}`);
    console.log(`isVisible: ${latestVideo.isVisible}`);
    console.log(`hlsUrl: ${latestVideo.hlsUrl ? '✅ PRESENT' : '❌ MISSING'}`);
    console.log(`thumbnailUrl: ${latestVideo.thumbnailUrl ? '✅ PRESENT' : '❌ MISSING'}`);
    if (latestVideo.thumbnailUrl) {
      console.log(`   ${latestVideo.thumbnailUrl}`);
    }
    console.log(`creatorId: ${latestVideo.creatorId || 'MISSING'}`);
    console.log(`isCollaboratorVideo: ${latestVideo.isCollaboratorVideo || false}`);
    console.log(`uploadId: ${latestVideo.uploadId || 'MISSING'}`);
    console.log(`fileId: ${latestVideo.fileId || 'MISSING'}`);
    console.log('');
    
    // Check stream key mapping
    if (latestVideo.streamKey) {
      console.log('🔑 STREAM KEY MAPPING:');
      console.log('='.repeat(60));
      try {
        const streamKeyParams = {
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${latestVideo.streamKey}`,
            SK: 'MAPPING'
          }
        };
        
        const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
        
        if (streamKeyResult.Item) {
          const mapping = streamKeyResult.Item;
          console.log(`streamKey: ${latestVideo.streamKey}`);
          console.log(`isCollaboratorKey: ${mapping.isCollaboratorKey || false}`);
          console.log(`collaboratorEmail: ${mapping.collaboratorEmail || 'MISSING'}`);
          console.log(`ownerEmail: ${mapping.ownerEmail || 'MISSING'}`);
          console.log(`channelName: ${mapping.channelName || mapping.seriesName || 'MISSING'}`);
          console.log(`creatorId: ${mapping.creatorId || 'MISSING'}`);
        } else {
          console.log(`❌ Stream key mapping NOT FOUND for: ${latestVideo.streamKey}`);
        }
      } catch (error) {
        console.error(`❌ Error looking up stream key mapping: ${error.message}`);
      }
      console.log('');
    }
    
    // Check username from creatorId
    if (latestVideo.creatorId) {
      console.log('👤 CREATOR USERNAME LOOKUP:');
      console.log('='.repeat(60));
      try {
        // Try USER#creatorId/PROFILE
        const profileParams = {
          TableName: table,
          Key: {
            PK: `USER#${latestVideo.creatorId}`,
            SK: 'PROFILE'
          }
        };
        
        const profileResult = await dynamodb.get(profileParams).promise();
        
        if (profileResult.Item) {
          console.log(`✅ Found profile for creatorId: ${latestVideo.creatorId}`);
          console.log(`   username: ${profileResult.Item.username || 'MISSING'}`);
          console.log(`   email: ${profileResult.Item.email || 'MISSING'}`);
        } else {
          console.log(`❌ Profile NOT FOUND for creatorId: ${latestVideo.creatorId}`);
          
          // Try to find by email from PK
          const emailFromPK = latestVideo.PK.replace('USER#', '');
          console.log(`   Trying email from PK: ${emailFromPK}`);
          
          const emailProfileParams = {
            TableName: table,
            Key: {
              PK: `USER#${emailFromPK}`,
              SK: 'PROFILE'
            }
          };
          
          const emailProfileResult = await dynamodb.get(emailProfileParams).promise();
          if (emailProfileResult.Item) {
            console.log(`✅ Found profile for email: ${emailFromPK}`);
            console.log(`   username: ${emailProfileResult.Item.username || 'MISSING'}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error looking up creator profile: ${error.message}`);
      }
      console.log('');
    }
    
    // Check if video is visible to admin account
    console.log('🔍 VISIBILITY CHECK:');
    console.log('='.repeat(60));
    const adminEmail = 'dehyu.sinyan@gmail.com';
    const videoEmail = latestVideo.PK.replace('USER#', '');
    console.log(`Video stored under: ${videoEmail}`);
    console.log(`Admin email: ${adminEmail}`);
    console.log(`Video visible to admin: ${videoEmail === adminEmail ? '✅ YES (stored under admin account)' : '❌ NO (stored under different account)'}`);
    console.log(`isVisible: ${latestVideo.isVisible}`);
    console.log(`isCollaboratorVideo: ${latestVideo.isCollaboratorVideo || false}`);
    console.log('');
    
    // Check if video would appear in get-content API
    console.log('📡 API VISIBILITY CHECK:');
    console.log('='.repeat(60));
    const hasValidThumbnail = latestVideo.thumbnailUrl && 
                              typeof latestVideo.thumbnailUrl === 'string' && 
                              latestVideo.thumbnailUrl.trim() !== '' &&
                              latestVideo.thumbnailUrl.startsWith('http');
    console.log(`Has valid thumbnail: ${hasValidThumbnail ? '✅' : '❌'}`);
    console.log(`Has HLS URL: ${latestVideo.hlsUrl ? '✅' : '❌'}`);
    console.log(`Has streamKey: ${latestVideo.streamKey ? '✅' : '❌'}`);
    console.log(`isVisible: ${latestVideo.isVisible !== false ? '✅' : '❌'}`);
    console.log(`Channel match: ${(latestVideo.folderName === 'Twilly TV' || latestVideo.seriesName === 'Twilly TV') ? '✅' : '❌'}`);
    
    const wouldAppear = hasValidThumbnail && 
                       latestVideo.hlsUrl && 
                       latestVideo.streamKey &&
                       latestVideo.isVisible !== false &&
                       (latestVideo.folderName === 'Twilly TV' || latestVideo.seriesName === 'Twilly TV');
    
    console.log(`\n${wouldAppear ? '✅' : '❌'} Video ${wouldAppear ? 'SHOULD' : 'SHOULD NOT'} appear in get-content API`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

investigateLastStream().catch(console.error);
