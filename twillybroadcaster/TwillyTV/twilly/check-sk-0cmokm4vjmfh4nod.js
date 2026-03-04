const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function checkStreamKey() {
  console.log('🔍 Checking streamKey: sk_0cmokm4vjmfh4nod\n');

  const streamKey = 'sk_0cmokm4vjmfh4nod';

  // Check streamKey mapping
  try {
    const streamKeyParams = {
      TableName: table,
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      }
    };
    const streamKeyResult = await dynamodb.get(streamKeyParams).promise();
    
    if (streamKeyResult.Item) {
      console.log(`✅ StreamKey mapping found:`);
      console.log(`   collaboratorEmail: ${streamKeyResult.Item.collaboratorEmail || 'N/A'}`);
      console.log(`   ownerEmail: ${streamKeyResult.Item.ownerEmail || 'N/A'}`);
      console.log(`   creatorId: ${streamKeyResult.Item.creatorId || 'N/A'}`);
      console.log(`   channelName: ${streamKeyResult.Item.channelName || 'N/A'}`);
      console.log(`   isCollaboratorKey: ${streamKeyResult.Item.isCollaboratorKey}`);
      
      const expectedOwner = streamKeyResult.Item.isCollaboratorKey 
        ? (streamKeyResult.Item.collaboratorEmail || streamKeyResult.Item.ownerEmail)
        : (streamKeyResult.Item.ownerEmail || streamKeyResult.Item.collaboratorEmail);
      
      console.log(`\n   📊 WHERE FILE SHOULD BE:`);
      console.log(`      Expected owner: ${expectedOwner || 'N/A'}`);
      console.log(`      Expected channel: ${streamKeyResult.Item.channelName || 'N/A'}`);
      
      // Search for files with this streamKey
      console.log(`\n   🔍 Searching for files with this streamKey...`);
      
      // Try expected owner first
      if (expectedOwner) {
        try {
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
            console.log(`   ✅ Found ${fileQuery.Items.length} file(s) under expected owner (${expectedOwner}):`);
            fileQuery.Items.forEach((file, idx) => {
              const time = file.createdAt || file.timestamp || 'N/A';
              const timeAgo = time !== 'N/A' ? Math.round((Date.now() - new Date(time).getTime()) / 1000 / 60) + ' minutes ago' : 'N/A';
              console.log(`      [${idx + 1}] ${file.fileName || 'N/A'}`);
              console.log(`          Channel: ${file.folderName || 'N/A'}`);
              console.log(`          Created: ${timeAgo}`);
              console.log(`          isVisible: ${file.isVisible}, hasHls: ${!!file.hlsUrl}`);
            });
          } else {
            console.log(`   ⚠️ No files found under expected owner (${expectedOwner})`);
          }
        } catch (err) {
          console.log(`   ❌ Error querying expected owner: ${err.message}`);
        }
      }
      
      // Also check other possible owners (in case it was stored wrong)
      const possibleOwners = [
        'dehyubuilds@gmail.com',
        'dehsin365@gmail.com',
        'dehyu.sinyan@gmail.com'
      ];
      
      for (const possibleOwner of possibleOwners) {
        if (possibleOwner !== expectedOwner) {
          try {
            const fileQuery = await dynamodb.query({
              TableName: table,
              KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
              FilterExpression: 'streamKey = :streamKey',
              ExpressionAttributeValues: {
                ':pk': `USER#${possibleOwner}`,
                ':skPrefix': 'FILE#',
                ':streamKey': streamKey
              }
            }).promise();
            
            if (fileQuery.Items && fileQuery.Items.length > 0) {
              console.log(`\n   ⚠️ Found ${fileQuery.Items.length} file(s) under WRONG owner (${possibleOwner}):`);
              fileQuery.Items.forEach((file, idx) => {
                const time = file.createdAt || file.timestamp || 'N/A';
                const timeAgo = time !== 'N/A' ? Math.round((Date.now() - new Date(time).getTime()) / 1000 / 60) + ' minutes ago' : 'N/A';
                console.log(`      [${idx + 1}] ${file.fileName || 'N/A'}`);
                console.log(`          Channel: ${file.folderName || 'N/A'}`);
                console.log(`          Created: ${timeAgo}`);
                console.log(`          Should be under: ${expectedOwner || 'N/A'}`);
              });
            }
          } catch (err) {
            // Ignore
          }
        }
      }
      
      // Check S3 to see if files were uploaded
      console.log(`\n   🔍 Checking S3 for uploaded files...`);
      try {
        const s3 = new AWS.S3({ region: 'us-east-2' });
        const listParams = {
          Bucket: 'theprivatecollection',
          Prefix: `clips/${streamKey}/`
        };
        
        const s3Objects = await s3.listObjectsV2(listParams).promise();
        if (s3Objects.Contents && s3Objects.Contents.length > 0) {
          console.log(`   ✅ Found ${s3Objects.Contents.length} file(s) in S3 for this streamKey`);
          const recentFiles = s3Objects.Contents
            .filter(obj => {
              const lastModified = obj.LastModified;
              return lastModified && (Date.now() - lastModified.getTime()) < 2 * 60 * 60 * 1000; // Last 2 hours
            })
            .sort((a, b) => b.LastModified.getTime() - a.LastModified.getTime());
          
          if (recentFiles.length > 0) {
            console.log(`   📋 Recent S3 files (last 2 hours):`);
            recentFiles.slice(0, 5).forEach((obj, idx) => {
              const timeAgo = Math.round((Date.now() - obj.LastModified.getTime()) / 1000 / 60) + ' minutes ago';
              console.log(`      [${idx + 1}] ${obj.Key}`);
              console.log(`          Last modified: ${timeAgo}`);
              console.log(`          Size: ${(obj.Size / 1024 / 1024).toFixed(2)} MB`);
            });
            console.log(`\n   ⚠️ Files exist in S3 but not in DynamoDB yet!`);
            console.log(`   This means Lambda hasn't processed them yet, or Lambda failed.`);
          } else {
            console.log(`   ⚠️ No recent files in S3 (last 2 hours)`);
          }
        } else {
          console.log(`   ⚠️ No files found in S3 for this streamKey`);
        }
      } catch (err) {
        console.log(`   ❌ Error checking S3: ${err.message}`);
      }
    } else {
      console.log(`❌ StreamKey mapping NOT FOUND`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  console.log('\n✅ Check complete!');
}

checkStreamKey().catch(console.error);
