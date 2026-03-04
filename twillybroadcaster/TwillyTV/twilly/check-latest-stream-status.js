const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({ region: 'us-east-2' });
const table = 'Twilly';

async function checkLatestStreamStatus() {
  console.log('🔍 Checking latest streamed video status...\n');

  // Find most recent S3 files (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  try {
    // List S3 files from last hour
    const s3List = await s3.listObjectsV2({
      Bucket: 'theprivatecollection',
      Prefix: 'clips/',
      MaxKeys: 1000
    }).promise();

    if (s3List.Contents && s3List.Contents.length > 0) {
      // Filter for master.m3u8 files from last hour
      const recentMasterFiles = s3List.Contents
        .filter(obj => {
          return obj.Key.includes('_master.m3u8') && 
                 obj.LastModified >= oneHourAgo;
        })
        .sort((a, b) => b.LastModified.getTime() - a.LastModified.getTime());

      if (recentMasterFiles.length > 0) {
        const latest = recentMasterFiles[0];
        const streamKey = latest.Key.match(/clips\/([^\/]+)\//)?.[1];
        const fileName = latest.Key.split('/').pop();
        const timeAgo = Math.round((Date.now() - latest.LastModified.getTime()) / 1000 / 60) + ' minutes ago';
        
        console.log(`📹 Latest streamed video:`);
        console.log(`   S3 Key: ${latest.Key}`);
        console.log(`   StreamKey: ${streamKey || 'N/A'}`);
        console.log(`   FileName: ${fileName}`);
        console.log(`   Uploaded: ${timeAgo}`);
        console.log(`   Size: ${(latest.Size / 1024).toFixed(2)} KB\n`);

        if (streamKey) {
          // Check streamKey mapping
          const streamKeyResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `STREAM_KEY#${streamKey}`,
              SK: 'MAPPING'
            }
          }).promise();

          if (streamKeyResult.Item) {
            const expectedOwner = streamKeyResult.Item.isCollaboratorKey 
              ? (streamKeyResult.Item.collaboratorEmail || streamKeyResult.Item.ownerEmail)
              : (streamKeyResult.Item.ownerEmail || streamKeyResult.Item.collaboratorEmail);
            
            const expectedChannel = streamKeyResult.Item.channelName || streamKeyResult.Item.seriesName;
            
            console.log(`📋 StreamKey mapping:`);
            console.log(`   Expected owner: ${expectedOwner || 'N/A'}`);
            console.log(`   Expected channel: ${expectedChannel || 'N/A'}`);
            console.log(`   isCollaboratorKey: ${streamKeyResult.Item.isCollaboratorKey}`);
            console.log(`   creatorId: ${streamKeyResult.Item.creatorId || 'N/A'}\n`);

            // Check if file exists in DynamoDB
            if (expectedOwner) {
              const fileQuery = await dynamodb.query({
                TableName: table,
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
                FilterExpression: 'streamKey = :streamKey',
                ExpressionAttributeValues: {
                  ':pk': `USER#${expectedOwner}`,
                  ':skPrefix': 'FILE#',
                  ':streamKey': streamKey
                }
              }).promise();

              if (fileQuery.Items && fileQuery.Items.length > 0) {
                const file = fileQuery.Items[0];
                const fileTime = file.createdAt || file.timestamp || 'N/A';
                const fileTimeAgo = fileTime !== 'N/A' ? Math.round((Date.now() - new Date(fileTime).getTime()) / 1000 / 60) + ' minutes ago' : 'N/A';
                
                console.log(`✅ FILE FOUND IN DYNAMODB:`);
                console.log(`   Owner: ${expectedOwner}`);
                console.log(`   Channel: ${file.folderName || file.seriesName || 'N/A'}`);
                console.log(`   Created: ${fileTimeAgo}`);
                console.log(`   isVisible: ${file.isVisible}`);
                console.log(`   hasHls: ${!!file.hlsUrl}`);
                console.log(`   FileName: ${file.fileName || 'N/A'}`);
                console.log(`\n   ✅ Video is ready and should appear in the "${file.folderName || file.seriesName || expectedChannel}" channel!`);
              } else {
                console.log(`❌ FILE NOT FOUND IN DYNAMODB`);
                console.log(`   The file is in S3 but Lambda hasn't created the DynamoDB entry yet.`);
                console.log(`   This could mean:`);
                console.log(`   1. Lambda is still processing (wait a few minutes)`);
                console.log(`   2. Lambda failed to process this file`);
                console.log(`   3. S3 event didn't trigger Lambda`);
                console.log(`\n   💡 The file should be stored under: ${expectedOwner}`);
                console.log(`   💡 In channel: ${expectedChannel || 'N/A'}`);
              }
            } else {
              console.log(`⚠️ Cannot determine expected owner - streamKey mapping incomplete`);
            }
          } else {
            console.log(`⚠️ StreamKey mapping not found for: ${streamKey}`);
          }
        }
      } else {
        console.log(`⚠️ No recent master.m3u8 files found in S3 (last hour)`);
      }
    } else {
      console.log(`⚠️ No files found in S3`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  console.log('\n✅ Check complete!');
}

checkLatestStreamStatus().catch(console.error);
