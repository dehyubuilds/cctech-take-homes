const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({ region: 'us-east-2' });
const table = 'Twilly';

async function checkLatestStream() {
  console.log('🔍 Checking latest stream from user "yess"...\n');

  // Find most recent files (last 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  
  try {
    // Get all files from last 10 minutes
    const allFilesScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#'
      }
    }).promise();

    if (allFilesScan.Items && allFilesScan.Items.length > 0) {
      // Filter and sort by timestamp
      const recentFiles = allFilesScan.Items
        .filter(f => {
          const fileTime = f.createdAt || f.timestamp;
          if (!fileTime) return false;
          return new Date(fileTime) >= tenMinutesAgo;
        })
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
          const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
          return bTime - aTime;
        });

      console.log(`✅ Found ${recentFiles.length} file(s) from last 10 minutes\n`);

      for (let i = 0; i < recentFiles.length; i++) {
        const file = recentFiles[i];
        const owner = file.PK ? file.PK.replace('USER#', '') : 'unknown';
        const time = file.createdAt || file.timestamp || 'N/A';
        const timeAgo = time !== 'N/A' ? Math.round((Date.now() - new Date(time).getTime()) / 1000 / 60) + ' minutes ago' : 'N/A';
        
        console.log(`[${i + 1}] ${file.fileName || 'N/A'}`);
        console.log(`    Owner: ${owner}`);
        console.log(`    Channel: ${file.folderName || file.seriesName || 'N/A'}`);
        console.log(`    streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`    Created: ${timeAgo}`);
        console.log(`    isVisible: ${file.isVisible}, hasHls: ${!!file.hlsUrl}`);
        
        // Check streamKey mapping
        if (file.streamKey) {
          try {
            const streamKeyResult = await dynamodb.get({
              TableName: table,
              Key: {
                PK: `STREAM_KEY#${file.streamKey}`,
                SK: 'MAPPING'
              }
            }).promise();
            
            if (streamKeyResult.Item) {
              console.log(`    StreamKey mapping:`);
              console.log(`      collaboratorEmail: ${streamKeyResult.Item.collaboratorEmail || 'N/A'}`);
              console.log(`      ownerEmail: ${streamKeyResult.Item.ownerEmail || 'N/A'}`);
              console.log(`      creatorId: ${streamKeyResult.Item.creatorId || 'N/A'}`);
              console.log(`      channelName: ${streamKeyResult.Item.channelName || 'N/A'}`);
              
              // Get username from creatorId
              if (streamKeyResult.Item.creatorId) {
                try {
                  const userProfile = await dynamodb.get({
                    TableName: table,
                    Key: {
                      PK: `USER#${streamKeyResult.Item.creatorId}`,
                      SK: 'PROFILE'
                    }
                  }).promise();
                  
                  if (userProfile.Item) {
                    const username = userProfile.Item.username || userProfile.Item.userName;
                    console.log(`      Username: ${username || 'N/A'}`);
                  }
                } catch (err) {
                  // Ignore
                }
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

  console.log('✅ Check complete!');
}

checkLatestStream().catch(console.error);
