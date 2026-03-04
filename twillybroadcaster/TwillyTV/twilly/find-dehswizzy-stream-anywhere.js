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

async function findDehswizzyStreamAnywhere() {
  console.log('🔍 Searching for dehswizzy stream everywhere...\n');
  console.log('='.repeat(80));
  
  // Step 1: Get dehswizzy profile
  const profileScan = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk AND username = :username',
    ExpressionAttributeValues: {
      ':pkPrefix': 'USER#',
      ':sk': 'PROFILE',
      ':username': 'dehswizzy'
    }
  }).promise();
  
  if (!profileScan.Items || profileScan.Items.length === 0) {
    console.log('❌ No profile found for dehswizzy');
    return;
  }
  
  const profile = profileScan.Items[0];
  const userEmail = profile.PK.replace('USER#', '');
  const userId = profile.userId;
  
  console.log(`✅ Found dehswizzy profile:`);
  console.log(`   Email/UserId: ${userEmail}`);
  console.log(`   userId: ${userId || 'N/A'}`);
  console.log(`   usernameVisibility: ${profile.usernameVisibility || 'N/A'}`);
  console.log(`   isPrivateUsername: ${profile.isPrivateUsername || false}\n`);
  
  // Step 2: Search ALL files for dehswizzy (by creatorId, streamerEmail, or creatorUsername)
  console.log('📋 STEP 2: Searching ALL files for dehswizzy...\n');
  
  const allFiles = [];
  let lastEvaluatedKey = null;
  
  do {
    const params = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#'
      }
    };
    
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }
    
    const result = await dynamodb.scan(params).promise();
    if (result.Items) {
      allFiles.push(...result.Items);
    }
    lastEvaluatedKey = result.LastEvaluatedKey;
    console.log(`   Scanned ${allFiles.length} files...`);
  } while (lastEvaluatedKey);
  
  console.log(`\n✅ Total files scanned: ${allFiles.length}\n`);
  
  // Filter for dehswizzy
  const dehswizzyFiles = allFiles.filter(file => {
    const creatorUsername = (file.creatorUsername || '').toLowerCase().replace('🔒', '');
    const streamerEmail = (file.streamerEmail || '').toLowerCase();
    const creatorId = file.creatorId || '';
    const pk = file.PK || '';
    
    return creatorUsername.includes('dehswizzy') || 
           streamerEmail.includes('dehswizzy') ||
           streamerEmail === userEmail ||
           creatorId === userId ||
           pk.includes(userEmail) ||
           pk.includes('dehswizzy');
  });
  
  if (dehswizzyFiles.length > 0) {
    console.log(`✅ Found ${dehswizzyFiles.length} file(s) from dehswizzy:\n`);
    
    // Sort by most recent
    dehswizzyFiles.sort((a, b) => {
      const aTime = new Date(a.timestamp || a.createdAt || 0).getTime();
      const bTime = new Date(b.timestamp || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    
    dehswizzyFiles.forEach((file, idx) => {
      const time = new Date(file.timestamp || file.createdAt || 0);
      const timeAgo = Math.round((Date.now() - time.getTime()) / 1000 / 60);
      console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
      console.log(`       PK: ${file.PK}`);
      console.log(`       SK: ${file.SK}`);
      console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
      console.log(`       folderName: ${file.folderName || 'N/A'}`);
      console.log(`       isVisible: ${file.isVisible}`);
      console.log(`       isPrivateUsername: ${file.isPrivateUsername}`);
      console.log(`       creatorUsername: ${file.creatorUsername || 'N/A'}`);
      console.log(`       creatorId: ${file.creatorId || 'N/A'}`);
      console.log(`       streamerEmail: ${file.streamerEmail || 'N/A'}`);
      console.log(`       Created: ${time.toISOString()} (${timeAgo} minutes ago)`);
      console.log(`       hlsUrl: ${file.hlsUrl ? '✅' : '❌'}`);
      console.log(`       thumbnailUrl: ${file.thumbnailUrl ? '✅' : '❌'}`);
      console.log('');
    });
    
    // Check most recent
    const mostRecent = dehswizzyFiles[0];
    console.log(`\n📋 Most Recent Stream Analysis:\n`);
    console.log(`   Why it might not be showing:`);
    
    if (mostRecent.folderName !== 'Twilly TV') {
      console.log(`   ⚠️  folderName is "${mostRecent.folderName}" (not "Twilly TV")`);
      console.log(`      → Stream is stored in wrong folder/channel`);
    }
    
    if (mostRecent.isVisible === false) {
      console.log(`   ⚠️  isVisible is FALSE - stream is hidden`);
    }
    
    if (mostRecent.isPrivateUsername === true) {
      console.log(`   ⚠️  isPrivateUsername is TRUE - stream is private`);
      console.log(`      → Private streams won't show in public timeline`);
    }
    
    if (!mostRecent.creatorUsername || mostRecent.creatorUsername.includes('🔒')) {
      console.log(`   ⚠️  creatorUsername is "${mostRecent.creatorUsername || 'N/A'}" (has lock or missing)`);
    }
    
    if (mostRecent.PK !== 'USER#dehyu.sinyan@gmail.com') {
      console.log(`   ⚠️  Stored under: ${mostRecent.PK} (not master account)`);
      console.log(`      → Twilly TV streams should be stored under master account`);
    }
    
  } else {
    console.log(`❌ No files found from dehswizzy anywhere\n`);
    
    // Check S3 for recent uploads
    console.log(`📋 STEP 3: Checking S3 for recent uploads...\n`);
    try {
      const s3Files = await s3.listObjectsV2({
        Bucket: BUCKET_NAME,
        Prefix: 'clips/',
        MaxKeys: 1000
      }).promise();
      
      if (s3Files.Contents && s3Files.Contents.length > 0) {
        // Get most recent files (last 2 hours)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const recentFiles = s3Files.Contents
          .filter(f => f.LastModified >= twoHoursAgo)
          .filter(f => f.Key.includes('_master.m3u8'))
          .sort((a, b) => b.LastModified - a.LastModified);
        
        console.log(`   Found ${recentFiles.length} recent master playlist(s) in S3:\n`);
        recentFiles.slice(0, 10).forEach((file, idx) => {
          const timeAgo = Math.round((Date.now() - file.LastModified.getTime()) / 1000 / 60);
          console.log(`   [${idx + 1}] ${file.Key}`);
          console.log(`       Modified: ${file.LastModified} (${timeAgo} minutes ago)`);
          console.log('');
        });
        
        if (recentFiles.length > 0) {
          console.log(`   ⚠️  Files exist in S3 but not in DynamoDB`);
          console.log(`   → Lambda might not have processed them yet, or processing failed\n`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Error checking S3: ${error.message}`);
    }
  }
  
  // Step 4: Check streamKey mappings
  console.log(`\n📋 STEP 4: Checking streamKey mappings for dehswizzy...\n`);
  const streamKeysScan = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':sk': 'MAPPING'
    }
  }).promise();
  
  if (streamKeysScan.Items && streamKeysScan.Items.length > 0) {
    const dehswizzyKeys = streamKeysScan.Items.filter(key => {
      const streamUsername = (key.streamUsername || '').toLowerCase().replace('🔒', '');
      const ownerEmail = (key.ownerEmail || '').toLowerCase();
      const collaboratorEmail = (key.collaboratorEmail || '').toLowerCase();
      const creatorId = key.creatorId || '';
      
      return streamUsername.includes('dehswizzy') ||
             ownerEmail.includes('dehswizzy') ||
             collaboratorEmail.includes('dehswizzy') ||
             creatorId === userId ||
             ownerEmail === userEmail ||
             collaboratorEmail === userEmail;
    });
    
    if (dehswizzyKeys.length > 0) {
      console.log(`   Found ${dehswizzyKeys.length} streamKey mapping(s):\n`);
      dehswizzyKeys.forEach((key, idx) => {
        const streamKey = key.PK.replace('STREAM_KEY#', '');
        console.log(`   [${idx + 1}] StreamKey: ${streamKey}`);
        console.log(`       streamUsername: ${key.streamUsername || 'N/A'}`);
        console.log(`       ownerEmail: ${key.ownerEmail || 'N/A'}`);
        console.log(`       collaboratorEmail: ${key.collaboratorEmail || 'N/A'}`);
        console.log(`       creatorId: ${key.creatorId || 'N/A'}`);
        console.log(`       channelName: ${key.channelName || key.seriesName || 'N/A'}`);
        console.log(`       isPrivateUsername: ${key.isPrivateUsername || false}`);
        console.log(`       createdAt: ${key.createdAt || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log(`   ❌ No streamKey mappings found for dehswizzy`);
    }
  }
}

findDehswizzyStreamAnywhere().catch(console.error);
