const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const cloudwatchlogs = new AWS.CloudWatchLogs({ region: 'us-east-2' });
const table = 'Twilly';
const BUCKET_NAME = 'theprivatecollection';

async function investigateStreamIssues() {
  console.log('🔍 COMPLETE INVESTIGATION: Thumbnail & 15-Minute Stream Issues\n');
  console.log('='.repeat(80));
  
  // Step 1: Check recent DynamoDB entries (last 2 hours)
  console.log('\n📊 STEP 1: Checking recent DynamoDB video entries (last 2 hours)...\n');
  
  const masterEmail = 'dehyu.sinyan@gmail.com';
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  try {
    const result = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${masterEmail}`,
        ':skPrefix': 'FILE#'
      }
    }).promise();
    
    // Filter by time in JavaScript instead of DynamoDB
    const videos = (result.Items || [])
      .filter(video => {
        const videoTime = new Date(video.createdAt || video.timestamp || 0);
        const twoHoursAgoTime = new Date(twoHoursAgo);
        return videoTime >= twoHoursAgoTime;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt || a.timestamp || 0);
        const timeB = new Date(b.createdAt || b.timestamp || 0);
        return timeB - timeA;
      });
    
    console.log(`✅ Found ${videos.length} recent video(s) in DynamoDB\n`);
    
    // Step 2: Check each video for thumbnail issues
    for (let i = 0; i < Math.min(10, videos.length); i++) {
      const video = videos[i];
      const createdAt = new Date(video.createdAt || video.timestamp);
      const minutesAgo = Math.floor((Date.now() - createdAt.getTime()) / 60000);
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`[${i + 1}] Video: ${video.fileName || video.SK}`);
      console.log(`Created: ${createdAt.toISOString()} (${minutesAgo} minutes ago)`);
      console.log(`streamKey: ${video.streamKey || 'N/A'}`);
      console.log(`uploadId: ${video.uploadId || 'N/A'}`);
      console.log(`folderName: ${video.folderName || 'N/A'}`);
      console.log(`isVisible: ${video.isVisible}`);
      console.log(`hlsUrl: ${video.hlsUrl ? '✅ YES' : '❌ NO'}`);
      console.log(`thumbnailUrl: ${video.thumbnailUrl ? '✅ YES' : '❌ NO'}`);
      
      if (video.thumbnailUrl) {
        console.log(`\n📦 Checking thumbnail in S3...`);
        console.log(`   DynamoDB URL: ${video.thumbnailUrl}`);
        
        // Extract S3 key from CloudFront URL
        const urlMatch = video.thumbnailUrl.match(/https:\/\/[^\/]+\/(.+)/);
        if (urlMatch) {
          const s3Key = urlMatch[1];
          console.log(`   Expected S3 key: ${s3Key}`);
          
          try {
            await s3.headObject({
              Bucket: BUCKET_NAME,
              Key: s3Key
            }).promise();
            console.log(`   ✅ Thumbnail EXISTS in S3`);
          } catch (error) {
            if (error.code === 'NotFound') {
              console.log(`   ❌ Thumbnail NOT FOUND in S3!`);
              console.log(`   → This is why the video shows but has no thumbnail`);
              
              // Check if thumbnail exists with different name
              console.log(`\n   🔍 Searching for thumbnails for this streamKey...`);
              if (video.streamKey) {
                const listResult = await s3.listObjectsV2({
                  Bucket: BUCKET_NAME,
                  Prefix: `clips/${video.streamKey}/`,
                  MaxKeys: 100
                }).promise();
                
                const thumbnails = (listResult.Contents || []).filter(item => 
                  item.Key.includes('_thumb.jpg')
                );
                
                if (thumbnails.length > 0) {
                  console.log(`   ⚠️ Found ${thumbnails.length} thumbnail(s) but with different names:`);
                  thumbnails.slice(0, 5).forEach((thumb, idx) => {
                    const thumbMinutesAgo = Math.floor((Date.now() - new Date(thumb.LastModified).getTime()) / 60000);
                    console.log(`      [${idx + 1}] ${thumb.Key} (${thumbMinutesAgo} minutes ago)`);
                  });
                } else {
                  console.log(`   ⚠️ No thumbnails found for streamKey: ${video.streamKey}`);
                }
              }
            } else {
              console.log(`   ⚠️ Error checking S3: ${error.message}`);
            }
          }
        }
      } else {
        console.log(`\n   ⚠️ No thumbnailUrl in DynamoDB entry`);
      }
      
      // Check streamKey mapping
      if (video.streamKey) {
        console.log(`\n🔍 Checking streamKey mapping...`);
        try {
          const streamKeyResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `STREAM_KEY#${video.streamKey}`,
              SK: 'MAPPING'
            }
          }).promise();
          
          if (streamKeyResult.Item) {
            console.log(`   ✅ StreamKey mapping found`);
            console.log(`   channelName: ${streamKeyResult.Item.channelName || 'N/A'}`);
            console.log(`   collaboratorEmail: ${streamKeyResult.Item.collaboratorEmail || 'N/A'}`);
            console.log(`   ownerEmail: ${streamKeyResult.Item.ownerEmail || 'N/A'}`);
            console.log(`   isCollaboratorKey: ${streamKeyResult.Item.isCollaboratorKey || 'N/A'}`);
          } else {
            console.log(`   ⚠️ StreamKey mapping NOT FOUND`);
          }
        } catch (error) {
          console.log(`   ❌ Error checking streamKey: ${error.message}`);
        }
      }
    }
    
    // Step 3: Check S3 for recent files (last 2 hours)
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📦 STEP 2: Checking S3 for recent files (last 2 hours)...\n');
    
    const s3Result = await s3.listObjectsV2({
      Bucket: BUCKET_NAME,
      Prefix: 'clips/',
      MaxKeys: 500
    }).promise();
    
    const twoHoursAgoTime = Date.now() - 2 * 60 * 60 * 1000;
    const recentS3Files = (s3Result.Contents || []).filter(file => {
      return new Date(file.LastModified).getTime() >= twoHoursAgoTime;
    }).sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
    
    console.log(`✅ Found ${recentS3Files.length} recent S3 file(s) in last 2 hours\n`);
    
    // Group by streamKey
    const filesByStreamKey = {};
    recentS3Files.forEach(file => {
      const match = file.Key.match(/clips\/([^\/]+)/);
      if (match) {
        const streamKey = match[1];
        if (!filesByStreamKey[streamKey]) {
          filesByStreamKey[streamKey] = [];
        }
        filesByStreamKey[streamKey].push(file);
      }
    });
    
    console.log(`📊 Files grouped by streamKey:\n`);
    Object.keys(filesByStreamKey).slice(0, 5).forEach(streamKey => {
      const files = filesByStreamKey[streamKey];
      const minutesAgo = Math.floor((Date.now() - new Date(files[0].LastModified).getTime()) / 60000);
      console.log(`   ${streamKey}: ${files.length} file(s) (${minutesAgo} minutes ago)`);
      
      const hasThumbnail = files.some(f => f.Key.includes('_thumb.jpg'));
      const hasMaster = files.some(f => f.Key.includes('_master.m3u8'));
      const hasHLS = files.some(f => f.Key.endsWith('.m3u8') || f.Key.endsWith('.ts'));
      
      console.log(`      - Thumbnail: ${hasThumbnail ? '✅' : '❌'}`);
      console.log(`      - Master playlist: ${hasMaster ? '✅' : '❌'}`);
      console.log(`      - HLS files: ${hasHLS ? '✅' : '❌'}`);
    });
    
    // Step 4: Check Lambda logs
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('STEP 3: Checking Lambda logs (last 2 hours)...\n');
    
    try {
      const logGroupName = '/aws/lambda/s3todynamo';
      const endTime = Date.now();
      const startTime = endTime - 2 * 60 * 60 * 1000;
      
      const logStreams = await cloudwatchlogs.describeLogStreams({
        logGroupName: logGroupName,
        orderBy: 'LastEventTime',
        descending: true,
        limit: 10
      }).promise();
      
      console.log(`✅ Found ${logStreams.logStreams.length} recent log stream(s)\n`);
      
      for (const stream of logStreams.logStreams.slice(0, 5)) {
        console.log(`📝 Log Stream: ${stream.logStreamName}`);
        console.log(`   Last Event: ${new Date(stream.lastEventTimestamp).toISOString()}`);
        
        try {
          const events = await cloudwatchlogs.getLogEvents({
            logGroupName: logGroupName,
            logStreamName: stream.logStreamName,
            startTime: startTime,
            endTime: endTime,
            limit: 50
          }).promise();
          
          if (events.events && events.events.length > 0) {
            console.log(`   Events: ${events.events.length}`);
            
            // Look for errors
            const errors = events.events.filter(e => 
              e.message.includes('ERROR') || 
              e.message.includes('Error') || 
              e.message.includes('❌') ||
              e.message.includes('Failed') ||
              e.message.includes('Exception')
            );
            
            if (errors.length > 0) {
              console.log(`   ⚠️ Found ${errors.length} error(s):`);
              errors.slice(0, 3).forEach(err => {
                console.log(`      - ${err.message.substring(0, 150)}...`);
              });
            }
            
            // Look for thumbnail-related logs
            const thumbnailLogs = events.events.filter(e => 
              e.message.includes('thumbnail') || 
              e.message.includes('Thumbnail') ||
              e.message.includes('🖼️')
            );
            
            if (thumbnailLogs.length > 0) {
              console.log(`   📸 Found ${thumbnailLogs.length} thumbnail-related log(s)`);
            }
          } else {
            console.log(`   ℹ️ No events in last 2 hours`);
          }
        } catch (error) {
          console.log(`   ⚠️ Error reading log stream: ${error.message}`);
        }
        console.log('');
      }
    } catch (error) {
      console.log(`⚠️ Error accessing CloudWatch logs: ${error.message}`);
      if (error.code === 'ResourceNotFoundException') {
        console.log(`   → Lambda log group not found. Lambda may not have been invoked recently.`);
      }
    }
    
    // Step 5: Summary and recommendations
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('📋 SUMMARY & RECOMMENDATIONS\n');
    
    const videosWithoutThumbnails = videos.filter(v => {
      if (!v.thumbnailUrl) return true;
      // We'd need to check S3, but for summary we'll just note it
      return false;
    });
    
    console.log(`✅ Total videos found: ${videos.length}`);
    console.log(`⚠️ Videos without thumbnails: ${videosWithoutThumbnails.length}`);
    console.log(`📦 Recent S3 files: ${recentS3Files.length}`);
    
    if (videos.length === 0 && recentS3Files.length === 0) {
      console.log(`\n❌ ISSUE: No recent activity found in last 2 hours!`);
      console.log(`   → The 15-minute stream may not have been processed yet, or`);
      console.log(`   → The stream may have failed before reaching the server.`);
    }
    
    if (videos.length > 0 && recentS3Files.length === 0) {
      console.log(`\n⚠️ WARNING: Videos in DynamoDB but no recent S3 files!`);
      console.log(`   → This suggests files were deleted or moved.`);
    }
    
    console.log(`\n✅ Investigation complete!`);
    
  } catch (error) {
    console.error(`❌ Error during investigation: ${error.message}`);
    console.error(error.stack);
  }
}

investigateStreamIssues().catch(console.error);
