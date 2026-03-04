const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const table = 'Twilly';
const BUCKET_NAME = 'theprivatecollection';

async function checkStreamProcessing() {
  const streamKey = 'twillytvdur4k9l2';
  const nonAdminEmail = 'dehyubuilds@gmail.com';
  
  console.log(`🔍 Checking stream processing for: ${streamKey}\n`);
  
  // Step 1: Check streamKey mapping
  console.log('STEP 1: StreamKey Mapping');
  const mapping = await dynamodb.get({
    TableName: table,
    Key: {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING'
    }
  }).promise();
  
  if (mapping.Item) {
    console.log(`✅ StreamKey mapping exists`);
    console.log(`   Created: ${mapping.Item.createdAt}`);
    console.log(`   Channel: ${mapping.Item.channelName || mapping.Item.seriesName}`);
    console.log(`   Collaborator: ${mapping.Item.collaboratorEmail || 'N/A'}`);
  } else {
    console.log(`❌ StreamKey mapping NOT FOUND`);
    return;
  }
  
  // Step 2: Check S3 for any files with this streamKey
  console.log('\nSTEP 2: S3 Files');
  try {
    const s3Files = await s3.listObjectsV2({
      Bucket: BUCKET_NAME,
      Prefix: `clips/${streamKey}/`
    }).promise();
    
    if (s3Files.Contents && s3Files.Contents.length > 0) {
      console.log(`✅ Found ${s3Files.Contents.length} file(s) in S3:`);
      s3Files.Contents.forEach((file, idx) => {
        console.log(`   [${idx + 1}] ${file.Key} (${(file.Size / 1024 / 1024).toFixed(2)}MB, ${new Date(file.LastModified).toISOString()})`);
      });
    } else {
      console.log(`❌ NO FILES in S3 for streamKey: ${streamKey}`);
      console.log(`   This means the stream was never processed or uploaded to S3`);
    }
  } catch (error) {
    console.log(`❌ Error checking S3: ${error.message}`);
  }
  
  // Step 3: Check DynamoDB for files
  console.log('\nSTEP 3: DynamoDB Files');
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
    console.log(`✅ Found ${dbFiles.Items.length} file(s) in DynamoDB:`);
    dbFiles.Items.forEach((file, idx) => {
      console.log(`   [${idx + 1}] ${file.fileName || file.SK}`);
      console.log(`       Stored under: ${file.PK}`);
      console.log(`       folderName: ${file.folderName || 'N/A'}`);
      console.log(`       isVisible: ${file.isVisible}`);
      console.log(`       createdAt: ${file.createdAt || 'N/A'}`);
    });
  } else {
    console.log(`❌ NO FILES in DynamoDB for streamKey: ${streamKey}`);
  }
  
  // Step 4: Check for metadata entries
  console.log('\nSTEP 4: Metadata Entries');
  const metadataScan = await dynamodb.scan({
    TableName: table,
    FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
    ExpressionAttributeValues: {
      ':pkPrefix': 'METADATA#',
      ':sk': 'video-details'
    }
  }).promise();
  
  const streamMetadata = (metadataScan.Items || []).filter(item => {
    const pk = item.PK.replace('METADATA#', '');
    return pk === streamKey || pk.includes(streamKey);
  });
  
  if (streamMetadata.length > 0) {
    console.log(`✅ Found ${streamMetadata.length} metadata entry/ies:`);
    streamMetadata.forEach((meta, idx) => {
      console.log(`   [${idx + 1}] ${meta.PK}`);
      console.log(`       title: ${meta.title || 'N/A'}`);
      console.log(`       createdAt: ${meta.createdAt || 'N/A'}`);
    });
  } else {
    console.log(`⚠️ No metadata entries found for streamKey: ${streamKey}`);
  }
  
  // Step 5: Check for any error records or processing status
  console.log('\nSTEP 5: Processing Status');
  const streamCreatedAt = new Date(mapping.Item.createdAt);
  const now = new Date();
  const ageInDays = (now - streamCreatedAt) / (1000 * 60 * 60 * 24);
  
  console.log(`   StreamKey created: ${streamCreatedAt.toISOString()}`);
  console.log(`   Age: ${ageInDays.toFixed(1)} days ago`);
  
  if (ageInDays > 1) {
    console.log(`   ⚠️ This streamKey is ${ageInDays.toFixed(1)} days old - likely an old test stream`);
  }
  
  // Summary
  console.log('\n📊 SUMMARY:');
  const hasS3Files = s3Files?.Contents?.length > 0;
  const hasDbFiles = dbFiles?.Items?.length > 0;
  
  if (!hasS3Files && !hasDbFiles) {
    console.log(`❌ Stream was NEVER PROCESSED`);
    console.log(`   - No files in S3`);
    console.log(`   - No files in DynamoDB`);
    console.log(`   - Possible causes:`);
    console.log(`     1. Stream never completed/uploaded`);
    console.log(`     2. Streaming service didn't process it`);
    console.log(`     3. Lambda didn't process S3 upload`);
    console.log(`     4. Stream was created but never used`);
  } else if (hasS3Files && !hasDbFiles) {
    console.log(`⚠️ Files in S3 but NOT in DynamoDB`);
    console.log(`   - Lambda may have failed to process S3 upload`);
  } else if (!hasS3Files && hasDbFiles) {
    console.log(`⚠️ Files in DynamoDB but NOT in S3`);
    console.log(`   - Files may have been deleted from S3`);
  } else {
    console.log(`✅ Stream was processed successfully`);
  }
}

checkStreamProcessing().catch(console.error);
