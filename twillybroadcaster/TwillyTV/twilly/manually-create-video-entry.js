const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({ region: 'us-east-2' });
const table = 'Twilly';
const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';

async function manuallyCreateVideoEntry() {
  console.log('🔧 Manually creating DynamoDB entry for latest streamed video...\n');

  const streamKey = 'sk_0cmokm4vjmfh4nod';
  const fileName = 'sk_0cmokm4vjmfh4nod_2026-01-30T18-57-43-126Z_ynybsxn2_master.m3u8';
  const s3Key = `clips/${streamKey}/${fileName}`;

  try {
    // Get streamKey mapping
    const streamKeyResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    }).promise();

    if (!streamKeyResult.Item) {
      console.log('❌ StreamKey mapping not found');
      return;
    }

    const mapping = streamKeyResult.Item;
    const expectedOwner = mapping.isCollaboratorKey 
      ? (mapping.collaboratorEmail || mapping.ownerEmail)
      : (mapping.ownerEmail || mapping.collaboratorEmail);
    
    // Try to find channel name from old file or mapping
    let channelName = mapping.channelName || mapping.seriesName;
    
    if (!channelName) {
      // Check old file
      const oldFileQuery = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: 'streamKey = :streamKey',
        ExpressionAttributeValues: {
          ':pk': 'USER#dehyu.sinyan@gmail.com',
          ':skPrefix': 'FILE#',
          ':streamKey': streamKey
        },
        Limit: 1
      }).promise();
      
      if (oldFileQuery.Items && oldFileQuery.Items.length > 0) {
        channelName = oldFileQuery.Items[0].folderName || oldFileQuery.Items[0].seriesName;
      }
    }
    
    if (!channelName) {
      channelName = 'Twilly After Dark'; // Default based on old file
    }

    console.log(`📋 StreamKey mapping:`);
    console.log(`   Expected owner: ${expectedOwner || 'N/A'}`);
    console.log(`   Channel: ${channelName}`);
    console.log(`   isCollaboratorKey: ${mapping.isCollaboratorKey}\n`);

    if (!expectedOwner) {
      console.log('❌ Cannot determine owner email');
      return;
    }

    // Check if file already exists
    const existingQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'streamKey = :streamKey AND fileName = :fileName',
      ExpressionAttributeValues: {
        ':pk': `USER#${expectedOwner}`,
        ':skPrefix': 'FILE#',
        ':streamKey': streamKey,
        ':fileName': fileName
      }
    }).promise();

    if (existingQuery.Items && existingQuery.Items.length > 0) {
      console.log('✅ File already exists in DynamoDB!');
      console.log(`   Owner: ${expectedOwner}`);
      console.log(`   Channel: ${existingQuery.Items[0].folderName || existingQuery.Items[0].seriesName}`);
      return;
    }

    // Get S3 file info
    const s3Object = await s3.headObject({
      Bucket: 'theprivatecollection',
      Key: s3Key
    }).promise();

    const timestamp = s3Object.LastModified.toISOString();
    const fileId = fileName.replace('_master.m3u8', '').split('_').pop(); // Extract uploadId
    const hlsUrl = `${cloudFrontBaseUrl}/${s3Key}`;
    
    // Generate thumbnail URL
    const thumbnailKey = s3Key.replace('_master.m3u8', '_thumb.jpg');
    const thumbnailUrl = `${cloudFrontBaseUrl}/${thumbnailKey}`;

    // Create video entry
    const videoItem = {
      PK: `USER#${expectedOwner}`,
      SK: `FILE#${fileId}`,
      fileId: fileId,
      fileName: fileName,
      fileExtension: '.m3u8',
      streamKey: streamKey,
      folderName: channelName,
      seriesName: channelName,
      category: 'video',
      hlsUrl: hlsUrl,
      thumbnailUrl: thumbnailUrl,
      url: hlsUrl,
      timestamp: timestamp,
      createdAt: timestamp,
      isVisible: true,
      isCollaboratorVideo: mapping.isCollaboratorKey || false,
      streamerEmail: expectedOwner
    };

    console.log(`📝 Creating video entry:`);
    console.log(`   PK: ${videoItem.PK}`);
    console.log(`   SK: ${videoItem.SK}`);
    console.log(`   Channel: ${channelName}`);
    console.log(`   HLS URL: ${hlsUrl}\n`);

    await dynamodb.put({
      TableName: table,
      Item: videoItem
    }).promise();

    console.log('✅ Successfully created DynamoDB entry!');
    console.log(`   The video should now appear in the "${channelName}" channel`);
    console.log(`   Under the account: ${expectedOwner}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }

  console.log('\n✅ Complete!');
}

manuallyCreateVideoEntry().catch(console.error);
