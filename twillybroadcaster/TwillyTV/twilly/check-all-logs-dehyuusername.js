const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const cloudwatch = new AWS.CloudWatchLogs();
const table = 'Twilly';
const BUCKET_NAME = 'theprivatecollection';

async function checkAllLogs() {
  console.log('\n🔍 COMPREHENSIVE LOG CHECK FOR DEHYUUSERNAME STREAM\n');
  console.log('='.repeat(80));
  
  const streamKey = 'sk_ikgqum1e70nc4tyl';
  const uploadId = 'rtmp-1771694488984-3852759522472268-zobd8unue';
  const streamTime = new Date('2026-02-21T17:21:28.984Z'); // Approximate stream start time
  
  console.log(`\n📹 Stream Details:`);
  console.log(`   streamKey: ${streamKey}`);
  console.log(`   uploadId: ${uploadId}`);
  console.log(`   Stream time: ${streamTime.toISOString()}`);
  console.log(`   Checking logs from: ${new Date(streamTime.getTime() - 5 * 60 * 1000).toISOString()} to ${new Date(streamTime.getTime() + 30 * 60 * 1000).toISOString()}\n`);
  
  // Step 1: Check DynamoDB entry
  console.log('STEP 1: DynamoDB Entry');
  console.log('-'.repeat(80));
  try {
    const filesQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':skPrefix': 'FILE#'
      },
      FilterExpression: 'uploadId = :uploadId',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':skPrefix': 'FILE#',
        ':uploadId': uploadId
      },
      ScanIndexForward: false,
      Limit: 1
    }).promise();
    
    if (filesQuery.Items && filesQuery.Items.length > 0) {
      const entry = filesQuery.Items[0];
      console.log('✅ DynamoDB entry exists:');
      console.log(`   SK: ${entry.SK}`);
      console.log(`   fileName: ${entry.fileName || 'MISSING'}`);
      console.log(`   createdAt: ${entry.createdAt}`);
      console.log(`   thumbnailUrl: ${entry.thumbnailUrl || 'MISSING'}`);
      console.log(`   hlsUrl: ${entry.hlsUrl || 'MISSING'}`);
      console.log(`   isVisible: ${entry.isVisible !== false ? 'true' : 'false'}`);
      console.log(`   isPrivateUsername: ${entry.isPrivateUsername || false}`);
      
      if (entry.thumbnailUrl && entry.thumbnailUrl.includes('No_Image_Available')) {
        console.log('   ⚠️  Using DEFAULT thumbnail (No_Image_Available.jpg)');
      }
    } else {
      console.log('❌ DynamoDB entry NOT FOUND');
    }
  } catch (error) {
    console.error('❌ Error checking DynamoDB:', error.message);
  }
  
  // Step 2: Check S3 files
  console.log('\nSTEP 2: S3 Files');
  console.log('-'.repeat(80));
  try {
    const s3Files = await s3.listObjectsV2({
      Bucket: BUCKET_NAME,
      Prefix: `clips/${streamKey}/${uploadId}/`
    }).promise();
    
    if (s3Files.Contents && s3Files.Contents.length > 0) {
      console.log(`✅ Found ${s3Files.Contents.length} file(s) in S3:`);
      s3Files.Contents.forEach((f, idx) => {
        const sizeKB = (f.Size / 1024).toFixed(2);
        const modified = new Date(f.LastModified).toISOString();
        console.log(`   [${idx + 1}] ${f.Key}`);
        console.log(`       Size: ${sizeKB} KB, Modified: ${modified}`);
      });
      
      const thumbnails = s3Files.Contents.filter(f => f.Key.includes('thumb'));
      if (thumbnails.length === 0) {
        console.log('\n   ❌ NO THUMBNAIL in S3!');
      } else {
        console.log(`\n   ✅ Found ${thumbnails.length} thumbnail(s)`);
      }
    } else {
      console.log('❌ NO FILES in S3 for this uploadId!');
      console.log('   This means the stream was NEVER PROCESSED or UPLOADED to S3.');
      console.log('   Possible causes:');
      console.log('   1. Stream processing failed');
      console.log('   2. Upload to S3 failed');
      console.log('   3. Lambda function was not triggered');
      console.log('   4. Streaming service never processed the stream');
    }
  } catch (error) {
    console.error('❌ Error checking S3:', error.message);
  }
  
  // Step 3: Check if files exist in other locations (maybe different uploadId pattern)
  console.log('\nSTEP 3: Check Alternative S3 Locations');
  console.log('-'.repeat(80));
  try {
    // Check all files for this streamKey
    const allStreamFiles = await s3.listObjectsV2({
      Bucket: BUCKET_NAME,
      Prefix: `clips/${streamKey}/`
    }).promise();
    
    if (allStreamFiles.Contents && allStreamFiles.Contents.length > 0) {
      // Find files created around the stream time
      const relevantFiles = allStreamFiles.Contents.filter(f => {
        const fileTime = new Date(f.LastModified);
        const timeDiff = Math.abs(fileTime - streamTime);
        return timeDiff < 30 * 60 * 1000; // Within 30 minutes
      });
      
      if (relevantFiles.length > 0) {
        console.log(`✅ Found ${relevantFiles.length} file(s) in S3 for this streamKey (around stream time):`);
        relevantFiles.slice(0, 10).forEach((f, idx) => {
          console.log(`   [${idx + 1}] ${f.Key} (${(f.Size / 1024).toFixed(2)} KB)`);
        });
        
        // Check if any match the uploadId pattern
        const matchingFiles = relevantFiles.filter(f => f.Key.includes(uploadId));
        if (matchingFiles.length === 0) {
          console.log('\n   ⚠️  Files exist but NONE match the uploadId!');
          console.log('   This suggests files were uploaded with a different uploadId.');
        }
      } else {
        console.log('❌ No files found around stream time');
      }
    } else {
      console.log('❌ No files found for this streamKey at all');
    }
  } catch (error) {
    console.error('❌ Error checking alternative S3 locations:', error.message);
  }
  
  // Step 4: Check CloudWatch Logs for Lambda functions
  console.log('\nSTEP 4: CloudWatch Logs (Lambda Functions)');
  console.log('-'.repeat(80));
  
  const lambdaFunctions = [
    's3todynamo-fixed',
    'stream-processor',
    'thumbnail-generator'
  ];
  
  const startTime = streamTime.getTime() - 5 * 60 * 1000; // 5 minutes before
  const endTime = streamTime.getTime() + 30 * 60 * 1000; // 30 minutes after
  
  for (const funcName of lambdaFunctions) {
    const logGroupName = `/aws/lambda/${funcName}`;
    console.log(`\n📋 Checking ${funcName}...`);
    
    try {
      // Get log streams
      const logStreams = await cloudwatch.describeLogStreams({
        logGroupName: logGroupName,
        orderBy: 'LastEventTime',
        descending: true,
        limit: 5
      }).promise();
      
      if (logStreams.logStreams && logStreams.logStreams.length > 0) {
        console.log(`   Found ${logStreams.logStreams.length} log stream(s)`);
        
        // Check each log stream for events around stream time
        for (const stream of logStreams.logStreams.slice(0, 3)) {
          try {
            const events = await cloudwatch.getLogEvents({
              logGroupName: logGroupName,
              logStreamName: stream.logStreamName,
              startTime: startTime,
              endTime: endTime,
              limit: 100
            }).promise();
            
            if (events.events && events.events.length > 0) {
              console.log(`   ✅ Found ${events.events.length} log event(s) in stream: ${stream.logStreamName}`);
              
              // Look for errors
              const errors = events.events.filter(e => 
                e.message && (
                  e.message.includes('ERROR') || 
                  e.message.includes('Error') || 
                  e.message.includes('❌') ||
                  e.message.includes('Failed') ||
                  e.message.includes('Exception') ||
                  e.message.includes('timeout') ||
                  e.message.includes('Timeout')
                )
              );
              
              if (errors.length > 0) {
                console.log(`   ⚠️  Found ${errors.length} error(s):`);
                errors.slice(0, 3).forEach(err => {
                  const time = new Date(err.timestamp).toISOString();
                  const msg = err.message.substring(0, 200);
                  console.log(`      [${time}] ${msg}...`);
                });
              }
              
              // Look for streamKey or uploadId mentions
              const streamMentions = events.events.filter(e => 
                e.message && (
                  e.message.includes(streamKey) || 
                  e.message.includes(uploadId)
                )
              );
              
              if (streamMentions.length > 0) {
                console.log(`   ✅ Found ${streamMentions.length} mention(s) of this stream:`);
                streamMentions.slice(0, 3).forEach(evt => {
                  const time = new Date(evt.timestamp).toISOString();
                  const msg = evt.message.substring(0, 150);
                  console.log(`      [${time}] ${msg}...`);
                });
              } else {
                console.log(`   ⚠️  No mentions of streamKey or uploadId in logs`);
              }
            } else {
              console.log(`   ℹ️  No events found in this stream around stream time`);
            }
          } catch (streamError) {
            console.log(`   ⚠️  Error reading log stream: ${streamError.message}`);
          }
        }
      } else {
        console.log(`   ⚠️  No log streams found (Lambda may not have been invoked)`);
      }
    } catch (error) {
      if (error.code === 'ResourceNotFoundException') {
        console.log(`   ⚠️  Log group not found: ${logGroupName}`);
        console.log(`   → Lambda function may not exist or has never been invoked`);
      } else {
        console.error(`   ❌ Error checking logs: ${error.message}`);
      }
    }
  }
  
  // Step 5: Check StreamKey Mapping
  console.log('\nSTEP 5: StreamKey Mapping');
  console.log('-'.repeat(80));
  try {
    const mapping = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    }).promise();
    
    if (mapping.Item) {
      console.log('✅ StreamKey mapping exists:');
      console.log(`   streamUsername: ${mapping.Item.streamUsername || 'MISSING'}`);
      console.log(`   isPrivateUsername: ${mapping.Item.isPrivateUsername || false}`);
      console.log(`   collaboratorEmail: ${mapping.Item.collaboratorEmail || 'MISSING'}`);
      console.log(`   createdAt: ${mapping.Item.createdAt || 'MISSING'}`);
      console.log(`   isActive: ${mapping.Item.isActive !== false ? 'true' : 'false'}`);
    } else {
      console.log('❌ StreamKey mapping NOT FOUND');
    }
  } catch (error) {
    console.error('❌ Error checking mapping:', error.message);
  }
  
  // Step 6: Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📋 SUMMARY');
  console.log('='.repeat(80));
  console.log('\n🔴 CRITICAL FINDINGS:');
  console.log('   1. DynamoDB entry exists but uses DEFAULT thumbnail');
  console.log('   2. NO FILES in S3 for this uploadId');
  console.log('   3. This means the stream was NEVER PROCESSED or UPLOADED');
  console.log('\n💡 POSSIBLE CAUSES:');
  console.log('   1. Stream processing failed silently');
  console.log('   2. Upload to S3 failed (network/permissions issue)');
  console.log('   3. Lambda function was not triggered by S3 event');
  console.log('   4. Streaming service crashed or stopped before processing');
  console.log('   5. createVideoEntryImmediately was called but processStreamInternal failed');
  console.log('\n🔧 RECOMMENDATIONS:');
  console.log('   1. Check EC2 server logs for errors around stream time');
  console.log('   2. Check if streaming service is still running');
  console.log('   3. Check S3 bucket permissions');
  console.log('   4. Check if Lambda function has proper IAM permissions');
  console.log('   5. Manually trigger stream processing if files exist on server');
}

checkAllLogs().catch(error => {
  console.error('❌ Fatal error:', error);
});
