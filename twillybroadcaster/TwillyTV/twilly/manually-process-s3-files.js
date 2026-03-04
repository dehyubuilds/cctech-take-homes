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
const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';

async function manuallyProcessS3Files() {
  const streamKey = 'twillytvdur4k9l2';
  
  console.log(`🔍 Manually processing S3 files for streamKey: ${streamKey}\n`);
  
  // Get all S3 files for this streamKey
  const s3Files = await s3.listObjectsV2({
    Bucket: BUCKET_NAME,
    Prefix: `clips/${streamKey}/`
  }).promise();
  
  if (!s3Files.Contents || s3Files.Contents.length === 0) {
    console.log('❌ No files found in S3');
    return;
  }
  
  // Filter for master playlist files only
  const masterPlaylists = s3Files.Contents.filter(file => 
    file.Key.includes('_master.m3u8')
  );
  
  console.log(`Found ${masterPlaylists.length} master playlist file(s)\n`);
  
  // Get streamKey mapping
  const mapping = await dynamodb.get({
    TableName: table,
    Key: {
      PK: `STREAM_KEY#${streamKey}`,
      SK: 'MAPPING'
    }
  }).promise();
  
  if (!mapping.Item) {
    console.log('❌ StreamKey mapping not found');
    return;
  }
  
  const folderName = mapping.Item.channelName || mapping.Item.seriesName || 'Twilly TV';
  const userEmail = mapping.Item.collaboratorEmail || mapping.Item.ownerEmail;
  const creatorId = mapping.Item.creatorId;
  const isCollaboratorKey = mapping.Item.isCollaboratorKey === true || 
                            mapping.Item.isCollaboratorKey === 'true' ||
                            mapping.Item.isCollaboratorKey === 1;
  
  console.log(`StreamKey mapping:`);
  console.log(`   folderName: ${folderName}`);
  console.log(`   userEmail: ${userEmail}`);
  console.log(`   creatorId: ${creatorId || 'N/A'}`);
  console.log(`   isCollaboratorKey: ${isCollaboratorKey}\n`);
  
  const masterEmail = 'dehyu.sinyan@gmail.com';
  
  // Process each master playlist
  for (const file of masterPlaylists) {
    const key = file.Key;
    const fileName = key.split('/').pop();
    const url = `${cloudFrontBaseUrl}/${key}`;
    
    console.log(`\n📹 Processing: ${fileName}`);
    console.log(`   S3 Key: ${key}`);
    console.log(`   URL: ${url}`);
    
    // Extract uploadId from filename if present
    // Format: {streamKey}_{timestamp}_{uploadId}_master.m3u8
    const parts = fileName.replace('_master.m3u8', '').split('_');
    let uploadId = null;
    if (parts.length >= 3) {
      uploadId = parts[parts.length - 1]; // Last part is uploadId
    }
    
    console.log(`   uploadId: ${uploadId || 'N/A'}`);
    
    // Check if file already exists in DynamoDB
    const existingFiles = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND fileName = :fileName',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#',
        ':fileName': fileName
      }
    }).promise();
    
    if (existingFiles.Items && existingFiles.Items.length > 0) {
      console.log(`   ⚠️ File already exists in DynamoDB, skipping`);
      continue;
    }
    
    // Create DynamoDB entry
    const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    const item = {
      PK: `USER#${masterEmail}`,
      SK: `FILE#${fileId}`,
      url: url,
      hlsUrl: url,
      fileName: fileName,
      fileExtension: 'm3u8',
      folderName: folderName,
      streamKey: streamKey,
      category: 'Videos',
      timestamp: timestamp,
      createdAt: timestamp,
      isVisible: false, // Will be set to true when user posts metadata
      isCollaboratorVideo: isCollaboratorKey,
      streamerEmail: userEmail
    };
    
    if (creatorId) {
      item.creatorId = creatorId;
    }
    
    if (uploadId) {
      item.uploadId = uploadId;
    }
    
    try {
      await dynamodb.put({
        TableName: table,
        Item: item
      }).promise();
      
      console.log(`   ✅ Created DynamoDB entry: ${fileId}`);
    } catch (error) {
      console.error(`   ❌ Error creating DynamoDB entry: ${error.message}`);
    }
  }
  
  console.log(`\n✅ Finished processing ${masterPlaylists.length} file(s)`);
}

manuallyProcessS3Files().catch(console.error);
