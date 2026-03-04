const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function traceLatestStream() {
  console.log('🔍 Tracing latest public stream from Twilly TV end-to-end...\n');
  console.log('='.repeat(80));
  
  // Step 1: Find most recent files in Twilly TV
  console.log('\n📋 STEP 1: Finding most recent files in Twilly TV...\n');
  const filesResult = await dynamodb.query({
    TableName: table,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': 'USER#dehyu.sinyan@gmail.com',
      ':sk': 'FILE#'
    },
    FilterExpression: 'folderName = :folderName',
    ExpressionAttributeValues: {
      ':pk': 'USER#dehyu.sinyan@gmail.com',
      ':sk': 'FILE#',
      ':folderName': 'Twilly TV'
    },
    Limit: 20,
    ScanIndexForward: false
  }).promise();
  
  if (!filesResult.Items || filesResult.Items.length === 0) {
    console.log('❌ No files found in Twilly TV');
    return;
  }
  
  // Group by fileName to find duplicates
  const filesByFileName = {};
  filesResult.Items.forEach(file => {
    const fileName = file.fileName || file.SK;
    if (!filesByFileName[fileName]) {
      filesByFileName[fileName] = [];
    }
    filesByFileName[fileName].push(file);
  });
  
  // Find duplicates
  const duplicates = Object.entries(filesByFileName).filter(([fileName, files]) => files.length > 1);
  
  if (duplicates.length > 0) {
    console.log(`⚠️  Found ${duplicates.length} duplicate file(s):\n`);
    
    for (const [fileName, files] of duplicates) {
      console.log(`\n📄 FileName: ${fileName}`);
      console.log(`   Found ${files.length} duplicate entries:\n`);
      
      files.forEach((file, idx) => {
        console.log(`   [${idx + 1}] Entry Details:`);
        console.log(`       PK: ${file.PK}`);
        console.log(`       SK: ${file.SK}`);
        console.log(`       fileId: ${file.fileId || 'N/A'}`);
        console.log(`       uploadId: ${file.uploadId || 'N/A'}`);
        console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`       timestamp: ${file.timestamp || file.createdAt || 'N/A'}`);
        console.log(`       createdAt: ${file.createdAt || 'N/A'}`);
        console.log(`       hlsUrl: ${file.hlsUrl ? '✅' : '❌'}`);
        console.log(`       thumbnailUrl: ${file.thumbnailUrl ? '✅' : '❌'}`);
        console.log(`       isVisible: ${file.isVisible}`);
        console.log(`       isPrivateUsername: ${file.isPrivateUsername}`);
        console.log(`       creatorUsername: ${file.creatorUsername || 'N/A'}`);
        console.log(`       creatorId: ${file.creatorId || 'N/A'}`);
        console.log(`       isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
        console.log('');
      });
      
      // Check if they have different PK/SK (which would allow both to exist)
      const uniqueKeys = new Set(files.map(f => `${f.PK}#${f.SK}`));
      if (uniqueKeys.size === files.length) {
        console.log(`   ⚠️  DUPLICATE ROOT CAUSE: Different PK/SK combinations!`);
        console.log(`       This means ConditionExpression didn't prevent duplicates because`);
        console.log(`       each entry has a unique primary key.\n`);
        
        // Check what's different
        const pks = [...new Set(files.map(f => f.PK))];
        const sks = [...new Set(files.map(f => f.SK))];
        
        if (pks.length > 1) {
          console.log(`       Different PKs: ${pks.join(', ')}`);
        }
        if (sks.length > 1) {
          console.log(`       Different SKs: ${sks.join(', ')}`);
          console.log(`       → This is the problem! Different SK means different fileIds`);
          console.log(`       → createVideoEntryImmediately and Lambda are using different fileIds\n`);
        }
      } else {
        console.log(`   ⚠️  DUPLICATE ROOT CAUSE: Same PK/SK but both entries exist!`);
        console.log(`       This means ConditionExpression failed or wasn't used.\n`);
      }
    }
    
    // Step 2: Check streamKey mapping
    if (duplicates[0] && duplicates[0][1][0].streamKey) {
      const streamKey = duplicates[0][1][0].streamKey;
      console.log(`\n📋 STEP 2: Checking streamKey mapping for: ${streamKey}\n`);
      
      const mappingResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `STREAM_KEY#${streamKey}`,
          SK: 'MAPPING'
        }
      }).promise();
      
      if (mappingResult.Item) {
        console.log('   StreamKey Mapping:');
        console.log(`     ownerEmail: ${mappingResult.Item.ownerEmail || 'N/A'}`);
        console.log(`     collaboratorEmail: ${mappingResult.Item.collaboratorEmail || 'N/A'}`);
        console.log(`     channelName: ${mappingResult.Item.channelName || mappingResult.Item.seriesName || 'N/A'}`);
        console.log(`     isPersonalKey: ${mappingResult.Item.isPersonalKey || false}`);
        console.log(`     isCollaboratorKey: ${mappingResult.Item.isCollaboratorKey || false}`);
        console.log(`     creatorId: ${mappingResult.Item.creatorId || 'N/A'}`);
        console.log(`     streamUsername: ${mappingResult.Item.streamUsername || 'N/A'}`);
        console.log(`     isPrivateUsername: ${mappingResult.Item.isPrivateUsername || false}`);
      }
    }
    
    // Step 3: Check S3 files
    if (duplicates[0] && duplicates[0][1][0].streamKey) {
      const streamKey = duplicates[0][1][0].streamKey;
      console.log(`\n📋 STEP 3: Checking S3 files for streamKey: ${streamKey}\n`);
      
      const s3 = new AWS.S3({ region: 'us-east-2' });
      const bucketName = 'theprivatecollection';
      
      try {
        const s3Files = await s3.listObjectsV2({
          Bucket: bucketName,
          Prefix: `clips/${streamKey}/`
        }).promise();
        
        if (s3Files.Contents && s3Files.Contents.length > 0) {
          const masterPlaylists = s3Files.Contents.filter(f => f.Key.includes('_master.m3u8'));
          console.log(`   Found ${masterPlaylists.length} master playlist(s) in S3:`);
          masterPlaylists.forEach((file, idx) => {
            console.log(`     [${idx + 1}] ${file.Key}`);
            console.log(`         Modified: ${file.LastModified}`);
            console.log(`         Size: ${file.Size} bytes`);
          });
        }
      } catch (error) {
        console.log(`   ⚠️  Error checking S3: ${error.message}`);
      }
    }
    
    // Step 4: Analyze the duplicate pattern
    console.log(`\n📋 STEP 4: Analyzing duplicate pattern...\n`);
    
    const firstDuplicate = duplicates[0][1];
    const fileIds = firstDuplicate.map(f => f.fileId || f.SK?.replace('FILE#', '') || 'N/A');
    const uploadIds = firstDuplicate.map(f => f.uploadId || 'N/A');
    
    console.log(`   FileIds used: ${fileIds.join(', ')}`);
    console.log(`   UploadIds used: ${uploadIds.join(', ')}`);
    
    if (fileIds.length > 1 && fileIds[0] !== fileIds[1]) {
      console.log(`\n   ⚠️  ROOT CAUSE IDENTIFIED:`);
      console.log(`       createVideoEntryImmediately uses: file-${uploadIds[0] || 'uploadId'}`);
      console.log(`       Lambda might be using: ${fileIds[1] || 'different fileId'}`);
      console.log(`       → They're generating different fileIds, so ConditionExpression doesn't help!`);
      console.log(`       → Both can succeed because they have different SK values.\n`);
    }
    
  } else {
    console.log('✅ No duplicates found in recent files');
    
    // Show most recent file details
    const mostRecent = filesResult.Items[0];
    console.log(`\n📄 Most recent file:`);
    console.log(`   fileName: ${mostRecent.fileName || 'N/A'}`);
    console.log(`   PK: ${mostRecent.PK}`);
    console.log(`   SK: ${mostRecent.SK}`);
    console.log(`   fileId: ${mostRecent.fileId || 'N/A'}`);
    console.log(`   uploadId: ${mostRecent.uploadId || 'N/A'}`);
    console.log(`   streamKey: ${mostRecent.streamKey || 'N/A'}`);
    console.log(`   timestamp: ${mostRecent.timestamp || mostRecent.createdAt || 'N/A'}`);
  }
}

traceLatestStream().catch(console.error);
