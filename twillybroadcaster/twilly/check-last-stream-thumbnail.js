const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-2' });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

async function checkLastStreamThumbnail() {
  try {
    console.log('🔍 Checking last stream thumbnail status...\n');
    
    // Query for the most recent video entry
    const queryParams = {
      TableName: 'Twilly',
      IndexName: 'GSI-createdAt',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com'
      },
      ScanIndexForward: false, // Most recent first
      Limit: 5
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
      
      console.log(`📹 Video: ${fileName}`);
      console.log(`   Created: ${createdAt}`);
      console.log(`   Thumbnail URL: ${thumbnailUrl || '❌ MISSING'}`);
      
      if (thumbnailUrl) {
        // Extract S3 key from CloudFront URL
        const s3KeyMatch = thumbnailUrl.match(/https:\/\/[^\/]+\/(.+)/);
        if (s3KeyMatch) {
          const s3Key = s3KeyMatch[1];
          console.log(`   S3 Key: ${s3Key}`);
          
          // Check if thumbnail exists in S3
          try {
            await s3.headObject({
              Bucket: 'theprivatecollection',
              Key: s3Key
            }).promise();
            console.log(`   ✅ Thumbnail EXISTS in S3`);
          } catch (s3Error) {
            if (s3Error.code === 'NotFound') {
              console.log(`   ❌ Thumbnail NOT FOUND in S3`);
            } else {
              console.log(`   ⚠️ Error checking S3: ${s3Error.message}`);
            }
          }
        }
      } else {
        // Check if thumbnail might exist in S3 but not in DynamoDB
        const streamName = item.streamKey || fileName.split('_')[0];
        const uploadId = item.uploadId || 'unknown';
        const uniquePrefix = fileName.split('_').slice(0, -1).join('_') || fileName.replace('.m3u8', '');
        
        const potentialS3Key = `clips/${streamName}/${uploadId}/${uniquePrefix}_thumb.jpg`;
        console.log(`   🔍 Checking potential S3 path: ${potentialS3Key}`);
        
        try {
          await s3.headObject({
            Bucket: 'theprivatecollection',
            Key: potentialS3Key
          }).promise();
          console.log(`   ✅ Thumbnail EXISTS in S3 but missing from DynamoDB!`);
        } catch (s3Error) {
          if (s3Error.code === 'NotFound') {
            console.log(`   ❌ Thumbnail NOT FOUND in S3 either`);
          } else {
            console.log(`   ⚠️ Error checking S3: ${s3Error.message}`);
          }
        }
      }
      
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkLastStreamThumbnail();
