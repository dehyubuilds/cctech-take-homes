const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findAllDuplicates() {
  console.log('🔍 Finding ALL duplicate files by fileName...\n');
  console.log('='.repeat(80));
  
  // Scan all files
  console.log('\n📋 Scanning all files in DynamoDB...\n');
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
    console.log(`   Scanned ${allFiles.length} files so far...`);
  } while (lastEvaluatedKey);
  
  console.log(`\n✅ Total files scanned: ${allFiles.length}\n`);
  
  // Group by fileName
  const filesByFileName = {};
  allFiles.forEach(file => {
    const fileName = file.fileName || file.SK?.replace('FILE#', '') || 'unknown';
    if (!filesByFileName[fileName]) {
      filesByFileName[fileName] = [];
    }
    filesByFileName[fileName].push(file);
  });
  
  // Find duplicates
  const duplicates = Object.entries(filesByFileName)
    .filter(([fileName, files]) => files.length > 1)
    .sort((a, b) => {
      // Sort by most recent first
      const aTime = Math.max(...a[1].map(f => new Date(f.timestamp || f.createdAt || 0).getTime()));
      const bTime = Math.max(...b[1].map(f => new Date(f.timestamp || f.createdAt || 0).getTime()));
      return bTime - aTime;
    });
  
  if (duplicates.length === 0) {
    console.log('✅ No duplicates found by fileName');
    return;
  }
  
  console.log(`⚠️  Found ${duplicates.length} duplicate file(s) by fileName:\n`);
  
  // Show top 5 most recent duplicates
  const topDuplicates = duplicates.slice(0, 5);
  
  for (const [fileName, files] of topDuplicates) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📄 FileName: ${fileName}`);
    console.log(`   Found ${files.length} duplicate entries:\n`);
    
    // Sort by timestamp
    files.sort((a, b) => {
      const aTime = new Date(a.timestamp || a.createdAt || 0).getTime();
      const bTime = new Date(b.timestamp || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    
    files.forEach((file, idx) => {
      const time = new Date(file.timestamp || file.createdAt || 0);
      const timeAgo = Math.round((Date.now() - time.getTime()) / 1000 / 60);
      
      console.log(`   [${idx + 1}] Entry Details:`);
      console.log(`       PK: ${file.PK}`);
      console.log(`       SK: ${file.SK}`);
      console.log(`       fileId: ${file.fileId || 'N/A'}`);
      console.log(`       uploadId: ${file.uploadId || 'N/A'}`);
      console.log(`       streamKey: ${file.streamKey || 'N/A'}`);
      console.log(`       folderName: ${file.folderName || 'N/A'}`);
      console.log(`       Created: ${time.toISOString()} (${timeAgo} minutes ago)`);
      console.log(`       hlsUrl: ${file.hlsUrl ? '✅' : '❌'}`);
      console.log(`       thumbnailUrl: ${file.thumbnailUrl ? '✅' : '❌'}`);
      console.log(`       isVisible: ${file.isVisible}`);
      console.log(`       isPrivateUsername: ${file.isPrivateUsername}`);
      console.log(`       creatorUsername: ${file.creatorUsername || 'N/A'}`);
      console.log(`       creatorId: ${file.creatorId || 'N/A'}`);
      console.log(`       isCollaboratorVideo: ${file.isCollaboratorVideo || false}`);
      console.log('');
    });
    
    // Analyze the duplicate
    const uniqueKeys = new Set(files.map(f => `${f.PK}#${f.SK}`));
    const uniqueFileIds = new Set(files.map(f => f.fileId || f.SK?.replace('FILE#', '')).filter(Boolean));
    const uniqueUploadIds = new Set(files.map(f => f.uploadId).filter(Boolean));
    
    console.log(`   📊 Analysis:`);
    console.log(`       Unique PK/SK combinations: ${uniqueKeys.size} (out of ${files.length} entries)`);
    console.log(`       Unique fileIds: ${uniqueFileIds.size}`);
    console.log(`       Unique uploadIds: ${uniqueUploadIds.size}`);
    
    if (uniqueKeys.size === files.length) {
      console.log(`\n   ⚠️  ROOT CAUSE: Different PK/SK combinations!`);
      console.log(`       Each entry has a unique primary key, so ConditionExpression can't prevent them.`);
      
      const pks = [...new Set(files.map(f => f.PK))];
      const sks = [...new Set(files.map(f => f.SK))];
      
      if (pks.length > 1) {
        console.log(`       Different PKs: ${pks.join(', ')}`);
        console.log(`       → Files stored under different user accounts!`);
      }
      if (sks.length > 1) {
        console.log(`       Different SKs: ${sks.join(', ')}`);
        console.log(`       → Different fileIds used: ${Array.from(uniqueFileIds).join(', ')}`);
        console.log(`       → This means createVideoEntryImmediately and Lambda used different fileIds!`);
      }
    } else {
      console.log(`\n   ⚠️  ROOT CAUSE: Same PK/SK but multiple entries exist!`);
      console.log(`       This should be impossible - ConditionExpression should have prevented this.`);
      console.log(`       → Either ConditionExpression wasn't used, or there's a bug.`);
    }
    
    // Check time difference
    if (files.length >= 2) {
      const time1 = new Date(files[0].timestamp || files[0].createdAt || 0);
      const time2 = new Date(files[1].timestamp || files[1].createdAt || 0);
      const timeDiff = Math.abs(time1.getTime() - time2.getTime()) / 1000;
      console.log(`\n   ⏱️  Time difference between entries: ${timeDiff} seconds`);
      if (timeDiff < 5) {
        console.log(`       → Very close timestamps suggest race condition!`);
      }
    }
  }
}

findAllDuplicates().catch(console.error);
