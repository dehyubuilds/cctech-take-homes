const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ 
  region: 'us-east-2',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({ region: 'us-east-2' });

async function investigateThumbnailIssue() {
  try {
    console.log('🔍 Investigating thumbnail issue for latest stream...\n');
    
    // Query for the most recent video entry
    const queryParams = {
      TableName: 'Twilly',
      IndexName: 'GSI-createdAt',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com'
      },
      ScanIndexForward: false, // Most recent first
      Limit: 3
    };
    
    const result = await dynamodb.query(queryParams).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log('❌ No videos found');
      return;
    }
    
    console.log(`✅ Found ${result.Items.length} recent videos\n`);
    
    for (const item of result.Items) {
      const fileName = item.fileName || item.SK || 'unknown';
      const createdAt = item.createdAt || 'unknown';
      const thumbnailUrl = item.thumbnailUrl || null;
      const streamKey = item.streamKey || 'unknown';
      const uploadId = item.uploadId || 'unknown';
      
      console.log(`📹 Video: ${fileName}`);
      console.log(`   Created: ${createdAt}`);
      console.log(`   StreamKey: ${streamKey}`);
      console.log(`   UploadId: ${uploadId}`);
      console.log(`   Thumbnail URL: ${thumbnailUrl || '❌ MISSING'}`);
      
      if (thumbnailUrl) {
        // Extract S3 key from CloudFront URL
        const s3KeyMatch = thumbnailUrl.match(/https:\/\/[^\/]+\/(.+)/);
        if (s3KeyMatch) {
          const s3Key = s3KeyMatch[1];
          console.log(`   S3 Key: ${s3Key}`);
          
          // Check if thumbnail exists in S3
          try {
            const headResult = await s3.headObject({
              Bucket: 'theprivatecollection',
              Key: s3Key
            }).promise();
            console.log(`   ✅ Thumbnail EXISTS in S3 (${headResult.ContentLength} bytes)`);
          } catch (s3Error) {
            if (s3Error.code === 'NotFound' || s3Error.code === 'NoSuchKey') {
              console.log(`   ❌ Thumbnail NOT FOUND in S3`);
              console.log(`   → This is the problem! Thumbnail URL exists in DynamoDB but file doesn't exist in S3`);
              
              // Try to find the thumbnail in different possible locations
              const possibleKeys = [
                s3Key,
                `clips/${streamKey}/${uploadId}/${fileName.replace('_master.m3u8', '_thumb.jpg')}`,
                `clips/${streamKey}/${fileName.replace('_master.m3u8', '_thumb.jpg')}`
              ];
              
              console.log(`   🔍 Checking alternative S3 paths...`);
              for (const possibleKey of possibleKeys) {
                try {
                  await s3.headObject({
                    Bucket: 'theprivatecollection',
                    Key: possibleKey
                  }).promise();
                  console.log(`   ✅ Found thumbnail at alternative path: ${possibleKey}`);
                  break;
                } catch (e) {
                  // Not found, continue
                }
              }
            } else {
              console.log(`   ⚠️ Error checking S3: ${s3Error.message} (code: ${s3Error.code})`);
            }
          }
        } else {
          console.log(`   ⚠️ Could not extract S3 key from URL: ${thumbnailUrl}`);
        }
      } else {
        console.log(`   ❌ No thumbnail URL in DynamoDB entry`);
        console.log(`   → This means createVideoEntryImmediately didn't set a thumbnail (should use default)`);
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

investigateThumbnailIssue();
