import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const table = 'Twilly';

async function checkRecentStreams() {
  try {
    console.log('🔍 Checking most recent video streams...\n');
    
    // Query for the most recent video entries under admin account
    const queryParams = {
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
      Limit: 10,
      ScanIndexForward: false // Most recent first
    };
    
    // Try without filter first to get all recent videos
    const allVideosParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FILE#'
      },
      Limit: 20,
      ScanIndexForward: false
    };
    
    const result = await dynamodb.query(allVideosParams).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No videos found');
      return;
    }
    
    console.log(`✅ Found ${result.Items.length} recent videos\n`);
    console.log('='.repeat(80));
    
    for (let i = 0; i < result.Items.length; i++) {
      const item = result.Items[i];
      console.log(`\n📹 Video #${i + 1}:`);
      console.log(`   FileId: ${item.fileId || item.SK?.replace('FILE#', '') || 'N/A'}`);
      console.log(`   FileName: ${item.fileName || 'N/A'}`);
      console.log(`   StreamKey: ${item.streamKey || 'N/A'}`);
      console.log(`   UploadId: ${item.uploadId || 'N/A'}`);
      console.log(`   Created: ${item.createdAt || item.timestamp || 'N/A'}`);
      console.log(`   Folder: ${item.folderName || item.folderPath || 'N/A'}`);
      console.log(`   Is Visible: ${item.isVisible !== false ? 'YES' : 'NO'}`);
      console.log(`   Thumbnail: ${item.thumbnailUrl ? '✅ YES' : '❌ NO'}`);
      console.log(`   HLS URL: ${item.hlsUrl || item.url || 'N/A'}`);
      console.log(`   Creator: ${item.creatorUsername || item.creatorId || 'N/A'}`);
      console.log(`   Streamer: ${item.streamerEmail || 'N/A'}`);
      console.log(`   Is Private: ${item.isPrivateUsername ? 'YES' : 'NO'}`);
      
      // Try to get video duration from S3 metadata or file
      if (item.hlsUrl || item.url) {
        try {
          // Extract S3 key from URL
          const urlMatch = (item.hlsUrl || item.url).match(/https:\/\/[^\/]+\/(.+)/);
          if (urlMatch) {
            const s3Key = urlMatch[1];
            // Check if master playlist exists
            try {
              const headResult = await s3.headObject({
                Bucket: 'theprivatecollection',
                Key: s3Key
              }).promise();
              
              console.log(`   S3 File Size: ${(headResult.ContentLength / 1024 / 1024).toFixed(2)} MB`);
              console.log(`   S3 Last Modified: ${headResult.LastModified}`);
              
              // Try to read the m3u8 file to estimate duration
              if (s3Key.endsWith('.m3u8')) {
                try {
                  const m3u8Content = await s3.getObject({
                    Bucket: 'theprivatecollection',
                    Key: s3Key
                  }).promise();
                  
                  const m3u8Text = m3u8Content.Body.toString();
                  // Count segments - each segment is typically 6 seconds
                  const segmentCount = (m3u8Text.match(/\.ts/g) || []).length;
                  const estimatedDuration = segmentCount * 6;
                  
                  if (estimatedDuration > 0) {
                    const minutes = Math.floor(estimatedDuration / 60);
                    const seconds = estimatedDuration % 60;
                    console.log(`   Estimated Duration: ~${minutes}m ${seconds}s (${segmentCount} segments × 6s)`);
                  }
                } catch (m3u8Error) {
                  // Ignore - can't read m3u8
                }
              }
            } catch (s3Error) {
              console.log(`   ⚠️ S3 File: NOT FOUND or not accessible`);
            }
          }
        } catch (urlError) {
          // Ignore URL parsing errors
        }
      }
      
      // Check if there's a corresponding recording file
      if (item.streamKey) {
        const recordingPaths = [
          `/var/www/recordings/${item.streamKey}_*.mp4`,
          `/var/www/recordings/${item.streamKey}_*.mov`,
          `/tmp/recordings/${item.streamKey}_*.mp4`,
          `/tmp/recordings/${item.streamKey}_*.mov`
        ];
        console.log(`   📁 Recording paths to check: ${recordingPaths[0]}`);
      }
      
      console.log('-'.repeat(80));
    }
    
    // Check for videos that might be in processing queue or failed
    console.log('\n🔍 Checking for incomplete uploads...\n');
    
    // Look for metadata entries without corresponding video entries
    const metadataQuery = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'METADATA#'
      },
      Limit: 10,
      ScanIndexForward: false
    };
    
    // Use scan for metadata (since PK starts with METADATA#)
    const metadataScan = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'METADATA#'
      },
      Limit: 10
    };
    
    try {
      const metadataResult = await dynamodb.scan(metadataScan).promise();
      if (metadataResult.Items && metadataResult.Items.length > 0) {
        console.log(`📋 Found ${metadataResult.Items.length} recent metadata entries:\n`);
        for (const meta of metadataResult.Items.slice(0, 5)) {
          console.log(`   UploadId: ${meta.uploadId || meta.PK?.replace('METADATA#', '') || 'N/A'}`);
          console.log(`   StreamKey: ${meta.streamKey || 'N/A'}`);
          console.log(`   Created: ${meta.createdAt || 'N/A'}`);
          console.log(`   Title: ${meta.title || 'N/A'}`);
          console.log('   ---');
        }
      }
    } catch (metaError) {
      console.log(`⚠️ Could not check metadata: ${metaError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking recent streams:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the check
checkRecentStreams()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
