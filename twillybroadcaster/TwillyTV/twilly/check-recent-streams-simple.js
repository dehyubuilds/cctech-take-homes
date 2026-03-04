const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkRecentStreamsSimple() {
  console.log('🔍 Checking most recent 10 files from ALL users...\n');

  try {
    const allFilesScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#'
      }
    }).promise();

    if (allFilesScan.Items && allFilesScan.Items.length > 0) {
      // Sort by timestamp/createdAt (newest first)
      const sortedFiles = allFilesScan.Items
        .filter(f => f.createdAt || f.timestamp)
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
          const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
          return bTime - aTime;
        });

      console.log(`✅ Found ${sortedFiles.length} total files\n`);
      console.log(`📋 Most recent 10 files:\n`);
      
      for (let i = 0; i < Math.min(10, sortedFiles.length); i++) {
        const file = sortedFiles[i];
        const owner = file.PK ? file.PK.replace('USER#', '') : 'unknown';
        const time = file.createdAt || file.timestamp || 'N/A';
        const timeAgo = time !== 'N/A' ? Math.round((Date.now() - new Date(time).getTime()) / 1000 / 60) + ' minutes ago' : 'N/A';
        
        console.log(`[${i + 1}] ${file.fileName || 'N/A'}`);
        console.log(`    Stored under: ${owner}`);
        console.log(`    Channel: ${file.folderName || 'N/A'}`);
        console.log(`    streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`    uploadId: ${file.uploadId || 'N/A'}`);
        console.log(`    Created: ${time} (${timeAgo})`);
        
        // Check streamKey mapping for the first 3 most recent
        if (i < 3 && file.streamKey) {
          try {
            const streamKeyParams = {
              TableName: table,
              Key: {
                PK: `STREAM_KEY#${file.streamKey}`,
                SK: 'MAPPING'
              }
            };
            const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
            
            if (streamKeyResult.Item) {
              const expectedOwner = streamKeyResult.Item.isCollaboratorKey 
                ? (streamKeyResult.Item.collaboratorEmail || streamKeyResult.Item.ownerEmail)
                : (streamKeyResult.Item.ownerEmail || streamKeyResult.Item.collaboratorEmail);
              
              const expectedChannel = streamKeyResult.Item.channelName || file.folderName;
              
              if (expectedOwner && owner !== expectedOwner) {
                console.log(`    ❌ WRONG EMAIL! Should be: ${expectedOwner}`);
                console.log(`    ❌ This is why it's not appearing in "${expectedChannel}" channel!`);
              } else {
                console.log(`    ✅ Correct email - should appear in "${expectedChannel}" channel`);
              }
            }
          } catch (err) {
            // Ignore
          }
        }
        console.log('');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n✅ Check complete!');
}

checkRecentStreamsSimple().catch(console.error);
