const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const BUCKET_NAME = 'theprivatecollection';
const table = 'Twilly';

async function checkS3VsDynamoDB() {
  console.log('🔍 Checking S3 vs DynamoDB for recent streams...\n');
  
  // Get recent streamKeys
  const recentStreamKeys = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
    ExpressionAttributeValues: {
      ':pkPrefix': 'STREAM_KEY#',
      ':sk': 'MAPPING'
    }
  }).promise();
  
  const sortedKeys = recentStreamKeys.Items.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });
  
  const recentKeys = sortedKeys.slice(0, 5);
  
  for (const keyMapping of recentKeys) {
    const streamKey = keyMapping.streamKey || keyMapping.PK.replace('STREAM_KEY#', '');
    const channelName = keyMapping.channelName || keyMapping.seriesName || 'N/A';
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`StreamKey: ${streamKey}`);
    console.log(`Channel: ${channelName}`);
    console.log(`Created: ${keyMapping.createdAt || 'N/A'}`);
    
    // Check S3
    console.log(`\n📦 Checking S3...`);
    try {
      const s3Files = await s3.listObjectsV2({
        Bucket: BUCKET_NAME,
        Prefix: `clips/${streamKey}/`,
        MaxKeys: 20
      }).promise();
      
      if (s3Files.Contents && s3Files.Contents.length > 0) {
        console.log(`   ✅ Found ${s3Files.Contents.length} file(s) in S3`);
        const masterPlaylists = s3Files.Contents.filter(f => f.Key.includes('_master.m3u8'));
        const thumbnails = s3Files.Contents.filter(f => f.Key.includes('_thumb.jpg'));
        console.log(`   Master playlists: ${masterPlaylists.length}`);
        console.log(`   Thumbnails: ${thumbnails.length}`);
        
        if (masterPlaylists.length > 0) {
          const latest = masterPlaylists.sort((a, b) => 
            new Date(b.LastModified) - new Date(a.LastModified)
          )[0];
          console.log(`   Latest: ${latest.Key}`);
          console.log(`   Modified: ${latest.LastModified}`);
        }
      } else {
        console.log(`   ❌ NO FILES in S3 for streamKey: ${streamKey}`);
      }
    } catch (error) {
      console.log(`   ❌ Error checking S3: ${error.message}`);
    }
    
    // Check DynamoDB
    console.log(`\n💾 Checking DynamoDB...`);
    const dbFiles = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND streamKey = :streamKey',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#',
        ':streamKey': streamKey
      }
    }).promise();
    
    if (dbFiles.Items && dbFiles.Items.length > 0) {
      console.log(`   ✅ Found ${dbFiles.Items.length} file(s) in DynamoDB`);
      dbFiles.Items.forEach((file, idx) => {
        console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
        console.log(`       Stored under: ${file.PK}`);
        console.log(`       isVisible: ${file.isVisible}`);
      });
    } else {
      console.log(`   ❌ NO FILES in DynamoDB for streamKey: ${streamKey}`);
    }
    
    // Analysis
    console.log(`\n📊 Analysis:`);
    try {
      const s3Files = await s3.listObjectsV2({
        Bucket: BUCKET_NAME,
        Prefix: `clips/${streamKey}/`,
        MaxKeys: 20
      }).promise();
      
      const hasS3Files = s3Files.Contents && s3Files.Contents.length > 0;
      const hasDbFiles = dbFiles.Items && dbFiles.Items.length > 0;
      
      if (hasS3Files && !hasDbFiles) {
        console.log(`   ⚠️ ISSUE: Files exist in S3 but NOT in DynamoDB`);
        console.log(`   → Lambda did not process these files`);
        console.log(`   → Check Lambda logs for errors`);
        console.log(`   → Possible causes:`);
        console.log(`      - Lambda path parsing bug`);
        console.log(`      - Lambda timeout`);
        console.log(`      - Lambda error during processing`);
      } else if (!hasS3Files && !hasDbFiles) {
        console.log(`   ⚠️ ISSUE: No files in S3 or DynamoDB`);
        console.log(`   → Streaming service did not create/upload files`);
        console.log(`   → Check streaming service logs`);
        console.log(`   → Possible causes:`);
        console.log(`      - Stream ended before files were created`);
        console.log(`      - Streaming service error`);
        console.log(`      - NGINX recording failed`);
      } else if (hasS3Files && hasDbFiles) {
        console.log(`   ✅ Files exist in both S3 and DynamoDB`);
        // Check if stored correctly
        const wrongAccountFiles = dbFiles.Items.filter(f => 
          f.PK !== `USER#dehyu.sinyan@gmail.com`
        );
        if (wrongAccountFiles.length > 0) {
          console.log(`   ⚠️ ISSUE: ${wrongAccountFiles.length} file(s) stored under wrong account`);
        } else {
          console.log(`   ✅ All files stored under master account`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error in analysis: ${error.message}`);
    }
  }
}

checkS3VsDynamoDB().catch(console.error);
