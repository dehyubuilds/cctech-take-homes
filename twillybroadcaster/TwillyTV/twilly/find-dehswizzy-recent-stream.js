const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({ region: 'us-east-2' });
const table = 'Twilly';
const BUCKET_NAME = 'theprivatecollection';

async function findDehswizzyStream() {
  console.log('🔍 Finding dehswizzy recent stream...\n');
  console.log('='.repeat(80));
  
  // Step 1: Find all recent streamKey mappings (last 2 hours)
  console.log('\n📋 STEP 1: Finding recent streamKey mappings...\n');
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  
  const streamKeysResult = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':sk': 'MAPPING'
    }
  }).promise();
  
  if (!streamKeysResult.Items || streamKeysResult.Items.length === 0) {
    console.log('❌ No streamKey mappings found');
    return;
  }
  
  // Filter recent ones and look for dehswizzy
  const recentKeys = streamKeysResult.Items
    .filter(key => {
      const createdAt = new Date(key.createdAt || 0);
      return createdAt >= twoHoursAgo;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });
  
  console.log(`✅ Found ${recentKeys.length} recent streamKey mapping(s)\n`);
  
  // Look for dehswizzy in streamUsername or check creatorId
  const dehswizzyProfile = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND username = :username',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':sk': 'PROFILE',
      ':username': 'dehswizzy'
    }
  }).promise();
  
  const dehswizzyUserId = dehswizzyProfile.Items && dehswizzyProfile.Items.length > 0 
    ? dehswizzyProfile.Items[0].userId 
    : null;
  
  console.log(`   Looking for streams from dehswizzy (userId: ${dehswizzyUserId || 'N/A'})\n`);
  
  // Check each recent streamKey
  for (const keyMapping of recentKeys) {
    const streamKey = keyMapping.PK.replace('STREAM_KEY#', '');
    const streamUsername = keyMapping.streamUsername || 'N/A';
    const creatorId = keyMapping.creatorId || 'N/A';
    const ownerEmail = keyMapping.ownerEmail || 'N/A';
    const collaboratorEmail = keyMapping.collaboratorEmail || 'N/A';
    
    const isDehswizzy = streamUsername.toLowerCase().includes('dehswizzy') || 
                       creatorId === dehswizzyUserId ||
                       ownerEmail.includes('dehswizzy') ||
                       collaboratorEmail.includes('dehswizzy');
    
    if (isDehswizzy || recentKeys.length <= 5) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`StreamKey: ${streamKey}`);
      console.log(`   streamUsername: ${streamUsername}`);
      console.log(`   creatorId: ${creatorId}`);
      console.log(`   ownerEmail: ${ownerEmail}`);
      console.log(`   collaboratorEmail: ${collaboratorEmail}`);
      console.log(`   channelName: ${keyMapping.channelName || keyMapping.seriesName || 'N/A'}`);
      console.log(`   isPrivateUsername: ${keyMapping.isPrivateUsername || false}`);
      console.log(`   createdAt: ${keyMapping.createdAt || 'N/A'}`);
      
      // Check for files with this streamKey
      console.log(`\n   Checking for files with this streamKey...`);
      const filesScan = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND streamKey = :streamKey',
        ExpressionAttributeValues: {
          ':pkPrefix': 'USER#',
          ':skPrefix': 'FILE#',
          ':streamKey': streamKey
        }
      }).promise();
      
      if (filesScan.Items && filesScan.Items.length > 0) {
        console.log(`   ✅ Found ${filesScan.Items.length} file(s):\n`);
        filesScan.Items.forEach((file, idx) => {
          const time = new Date(file.timestamp || file.createdAt || 0);
          const timeAgo = Math.round((Date.now() - time.getTime()) / 1000 / 60);
          console.log(`     [${idx + 1}] ${file.fileName || file.SK}`);
          console.log(`         PK: ${file.PK}`);
          console.log(`         SK: ${file.SK}`);
          console.log(`         folderName: ${file.folderName || 'N/A'}`);
          console.log(`         isVisible: ${file.isVisible}`);
          console.log(`         isPrivateUsername: ${file.isPrivateUsername}`);
          console.log(`         creatorUsername: ${file.creatorUsername || 'N/A'}`);
          console.log(`         creatorId: ${file.creatorId || 'N/A'}`);
          console.log(`         streamerEmail: ${file.streamerEmail || 'N/A'}`);
          console.log(`         Created: ${time.toISOString()} (${timeAgo} minutes ago)`);
          console.log(`         hlsUrl: ${file.hlsUrl ? '✅' : '❌'}`);
          console.log(`         thumbnailUrl: ${file.thumbnailUrl ? '✅' : '❌'}`);
          console.log('');
          
          // Check why it might not be showing
          if (file.isVisible === false) {
            console.log(`         ⚠️  isVisible is FALSE`);
          }
          if (file.isPrivateUsername === true) {
            console.log(`         ⚠️  isPrivateUsername is TRUE`);
          }
          if (file.folderName !== 'Twilly TV') {
            console.log(`         ⚠️  folderName is "${file.folderName}" (not "Twilly TV")`);
          }
          if (!file.creatorUsername || file.creatorUsername.includes('🔒')) {
            console.log(`         ⚠️  creatorUsername is "${file.creatorUsername || 'N/A'}"`);
          }
        });
      } else {
        console.log(`   ❌ No files found for this streamKey`);
        
        // Check S3
        console.log(`\n   Checking S3 for files...`);
        try {
          const s3Files = await s3.listObjectsV2({
            Bucket: BUCKET_NAME,
            Prefix: `clips/${streamKey}/`
          }).promise();
          
          if (s3Files.Contents && s3Files.Contents.length > 0) {
            const masterPlaylists = s3Files.Contents.filter(f => f.Key.includes('_master.m3u8'));
            console.log(`   ✅ Found ${masterPlaylists.length} master playlist(s) in S3:`);
            masterPlaylists.forEach((file, idx) => {
              const timeAgo = Math.round((Date.now() - file.LastModified.getTime()) / 1000 / 60);
              console.log(`     [${idx + 1}] ${file.Key}`);
              console.log(`         Modified: ${file.LastModified} (${timeAgo} minutes ago)`);
            });
            console.log(`\n   ⚠️  Files exist in S3 but not in DynamoDB - Lambda might not have processed them yet`);
          } else {
            console.log(`   ❌ No files found in S3 either`);
          }
        } catch (error) {
          console.log(`   ⚠️  Error checking S3: ${error.message}`);
        }
      }
    }
  }
}

findDehswizzyStream().catch(console.error);
