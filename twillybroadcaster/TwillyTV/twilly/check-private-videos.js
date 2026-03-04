const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkPrivateVideos() {
  console.log('🔍 Checking for private videos in Twilly TV...\n');
  
  try {
    // Query for all files in Twilly TV channel (stored under admin account)
    const adminEmail = 'dehyu.sinyan@gmail.com';
    const channelName = 'Twilly TV';
    
    // First, get all files for Twilly TV
    const scanParams = {
      TableName: table,
      FilterExpression: 'PK = :pk AND category = :category AND folderName = :folderName',
      ExpressionAttributeValues: {
        ':pk': `USER#${adminEmail}`,
        ':category': 'Videos',
        ':folderName': channelName
      }
    };
    
    console.log('📋 Scanning for all videos in Twilly TV...\n');
    const result = await dynamodb.scan(scanParams).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No videos found in Twilly TV');
      return;
    }
    
    console.log(`✅ Found ${result.Items.length} total videos\n`);
    
    // Filter for private videos
    const privateVideos = [];
    const publicVideos = [];
    const videosWithoutFlag = [];
    
    for (const video of result.Items) {
      const isPrivate = video.isPrivateUsername === true || 
                       video.isPrivateUsername === 'true' || 
                       video.isPrivateUsername === 1 ||
                       (video.isPrivateUsername && video.isPrivateUsername.BOOL === true);
      
      const isPublic = video.isPrivateUsername === false || 
                      video.isPrivateUsername === 'false' || 
                      video.isPrivateUsername === 0 ||
                      (video.isPrivateUsername && video.isPrivateUsername.BOOL === false);
      
      const videoInfo = {
        fileName: video.fileName || 'MISSING',
        streamKey: video.streamKey || 'MISSING',
        createdAt: video.createdAt || video.timestamp || 'MISSING',
        creatorUsername: video.creatorUsername || 'NOT SET',
        streamerEmail: video.streamerEmail || 'NOT SET',
        isPrivateUsername: video.isPrivateUsername,
        isPrivateUsernameType: typeof video.isPrivateUsername,
        SK: video.SK
      };
      
      if (isPrivate) {
        privateVideos.push(videoInfo);
      } else if (isPublic) {
        publicVideos.push(videoInfo);
      } else {
        videosWithoutFlag.push(videoInfo);
      }
    }
    
    // Sort by creation date (newest first)
    const sortByDate = (a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA;
    };
    
    privateVideos.sort(sortByDate);
    publicVideos.sort(sortByDate);
    videosWithoutFlag.sort(sortByDate);
    
    console.log('='.repeat(80));
    console.log('🔒 PRIVATE VIDEOS');
    console.log('='.repeat(80));
    if (privateVideos.length === 0) {
      console.log('❌ No private videos found\n');
    } else {
      console.log(`✅ Found ${privateVideos.length} private video(s):\n`);
      privateVideos.forEach((video, index) => {
        console.log(`\n[${index + 1}] ${video.fileName}`);
        console.log(`   StreamKey: ${video.streamKey}`);
        console.log(`   Created: ${video.createdAt}`);
        console.log(`   Creator Username: ${video.creatorUsername}`);
        console.log(`   Streamer Email: ${video.streamerEmail}`);
        console.log(`   isPrivateUsername: ${video.isPrivateUsername} (type: ${video.isPrivateUsernameType})`);
        console.log(`   SK: ${video.SK}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🌐 PUBLIC VIDEOS');
    console.log('='.repeat(80));
    console.log(`✅ Found ${publicVideos.length} public video(s)`);
    if (publicVideos.length > 0) {
      console.log('\n📋 Most recent 5 public videos:');
      publicVideos.slice(0, 5).forEach((video, index) => {
        console.log(`\n[${index + 1}] ${video.fileName}`);
        console.log(`   StreamKey: ${video.streamKey}`);
        console.log(`   Created: ${video.createdAt}`);
        console.log(`   Creator Username: ${video.creatorUsername}`);
        console.log(`   Streamer Email: ${video.streamerEmail}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  VIDEOS WITHOUT FLAG');
    console.log('='.repeat(80));
    if (videosWithoutFlag.length === 0) {
      console.log('✅ All videos have isPrivateUsername flag set\n');
    } else {
      console.log(`⚠️  Found ${videosWithoutFlag.length} video(s) without isPrivateUsername flag:\n`);
      videosWithoutFlag.forEach((video, index) => {
        console.log(`\n[${index + 1}] ${video.fileName}`);
        console.log(`   StreamKey: ${video.streamKey}`);
        console.log(`   Created: ${video.createdAt}`);
        console.log(`   Creator Username: ${video.creatorUsername}`);
        console.log(`   isPrivateUsername: ${JSON.stringify(video.isPrivateUsername)} (type: ${video.isPrivateUsernameType})`);
      });
    }
    
    // Also check streamKey mappings for isPrivateUsername
    console.log('\n' + '='.repeat(80));
    console.log('🔑 CHECKING STREAMKEY MAPPINGS FOR PRIVATE FLAG');
    console.log('='.repeat(80));
    
    const streamKeyScanParams = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'STREAM_KEY#'
      }
    };
    
    const streamKeyResult = await dynamodb.scan(streamKeyScanParams).promise();
    
    if (!streamKeyResult.Items || streamKeyResult.Items.length === 0) {
      console.log('❌ No streamKey mappings found');
    } else {
      console.log(`✅ Found ${streamKeyResult.Items.length} streamKey mapping(s)\n`);
      
      const privateStreamKeys = [];
      const publicStreamKeys = [];
      const streamKeysWithoutFlag = [];
      
      for (const mapping of streamKeyResult.Items) {
        const streamKey = mapping.PK.replace('STREAM_KEY#', '');
        const isPrivate = mapping.isPrivateUsername === true || 
                         mapping.isPrivateUsername === 'true' || 
                         mapping.isPrivateUsername === 1;
        
        const isPublic = mapping.isPrivateUsername === false || 
                        mapping.isPrivateUsername === 'false' || 
                        mapping.isPrivateUsername === 0;
        
        const mappingInfo = {
          streamKey: streamKey,
          createdAt: mapping.createdAt || mapping.timestamp || 'MISSING',
          ownerEmail: mapping.ownerEmail || 'NOT SET',
          collaboratorEmail: mapping.collaboratorEmail || 'NOT SET',
          isPrivateUsername: mapping.isPrivateUsername,
          isPrivateUsernameType: typeof mapping.isPrivateUsername
        };
        
        if (isPrivate) {
          privateStreamKeys.push(mappingInfo);
        } else if (isPublic) {
          publicStreamKeys.push(mappingInfo);
        } else {
          streamKeysWithoutFlag.push(mappingInfo);
        }
      }
      
      // Sort by creation date (newest first)
      const sortMappingsByDate = (a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB - dateA;
      };
      
      privateStreamKeys.sort(sortMappingsByDate);
      publicStreamKeys.sort(sortMappingsByDate);
      streamKeysWithoutFlag.sort(sortMappingsByDate);
      
      console.log(`\n🔒 Private StreamKeys: ${privateStreamKeys.length}`);
      if (privateStreamKeys.length > 0) {
        console.log('\n📋 Most recent 10 private streamKeys:');
        privateStreamKeys.slice(0, 10).forEach((mapping, index) => {
          console.log(`\n[${index + 1}] StreamKey: ${mapping.streamKey}`);
          console.log(`   Created: ${mapping.createdAt}`);
          console.log(`   Owner Email: ${mapping.ownerEmail}`);
          console.log(`   Collaborator Email: ${mapping.collaboratorEmail}`);
          console.log(`   isPrivateUsername: ${mapping.isPrivateUsername} (type: ${mapping.isPrivateUsernameType})`);
        });
      }
      
      console.log(`\n🌐 Public StreamKeys: ${publicStreamKeys.length}`);
      console.log(`\n⚠️  StreamKeys without flag: ${streamKeysWithoutFlag.length}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPrivateVideos();
