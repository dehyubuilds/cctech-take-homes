const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3({ region: 'us-east-2' });
const table = 'Twilly';
const BUCKET_NAME = 'theprivatecollection';

async function checkRecentDynamoDBVideos() {
  console.log('🔍 Checking recent DynamoDB video entries (last 2 hours)...\n');
  console.log('='.repeat(80));
  
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const masterEmail = 'dehyu.sinyan@gmail.com';
  
  try {
    // Query master account for recent files
    const filesQuery = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${masterEmail}`,
        ':skPrefix': 'FILE#'
      }
    }).promise();
    
    if (!filesQuery.Items || filesQuery.Items.length === 0) {
      console.log('❌ No files found in DynamoDB');
      return;
    }
    
    // Filter for recent videos
    const recentVideos = (filesQuery.Items || [])
      .filter(file => {
        if (file.category !== 'Videos') return false;
        const createdAt = new Date(file.createdAt || file.timestamp || 0);
        return createdAt >= twoHoursAgo;
      })
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.timestamp || 0);
        const dateB = new Date(b.createdAt || b.timestamp || 0);
        return dateB - dateA;
      });
    
    if (recentVideos.length === 0) {
      console.log('⚠️ No recent videos found in the last 2 hours');
      console.log('   Checking last 10 videos regardless of time...\n');
      
      const last10 = (filesQuery.Items || [])
        .filter(f => f.category === 'Videos')
        .sort((a, b) => {
          const dateA = new Date(a.createdAt || a.timestamp || 0);
          const dateB = new Date(b.createdAt || b.timestamp || 0);
          return dateB - dateA;
        })
        .slice(0, 10);
      
      last10.forEach((file, idx) => {
        const timeAgo = Math.round((Date.now() - new Date(file.createdAt || file.timestamp || 0).getTime()) / 1000 / 60);
        console.log(`[${idx + 1}] ${file.fileName || file.SK}`);
        console.log(`    Created: ${file.createdAt || file.timestamp || 'N/A'} (${timeAgo} minutes ago)`);
        console.log(`    streamKey: ${file.streamKey || 'N/A'}`);
        console.log(`    hlsUrl: ${file.hlsUrl ? '✅' : '❌'}`);
        console.log(`    thumbnailUrl: ${file.thumbnailUrl ? '✅' : '❌'}`);
        if (file.thumbnailUrl) {
          const isValid = file.thumbnailUrl && 
                         file.thumbnailUrl.trim() !== '' &&
                         file.thumbnailUrl !== 'null' &&
                         file.thumbnailUrl !== 'undefined' &&
                         file.thumbnailUrl.startsWith('http');
          console.log(`    thumbnailUrl valid: ${isValid ? '✅' : '❌'}`);
          if (!isValid) {
            console.log(`    ⚠️ INVALID: ${file.thumbnailUrl}`);
          }
        }
        console.log(`    isVisible: ${file.isVisible}`);
        console.log(`    folderName: ${file.folderName || 'N/A'}`);
        console.log('');
      });
      return;
    }
    
    console.log(`✅ Found ${recentVideos.length} recent video(s)\n`);
    
    for (let i = 0; i < recentVideos.length; i++) {
      const file = recentVideos[i];
      const timeAgo = Math.round((Date.now() - new Date(file.createdAt || file.timestamp || 0).getTime()) / 1000 / 60);
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`[${i + 1}/${recentVideos.length}] ${file.fileName || file.SK}`);
      console.log(`Created: ${file.createdAt || file.timestamp || 'N/A'} (${timeAgo} minutes ago)`);
      console.log(`streamKey: ${file.streamKey || 'N/A'}`);
      console.log(`folderName: ${file.folderName || 'N/A'}`);
      console.log(`isVisible: ${file.isVisible}`);
      console.log(`hlsUrl: ${file.hlsUrl ? '✅ YES' : '❌ NO'}`);
      console.log(`thumbnailUrl: ${file.thumbnailUrl ? '✅ YES' : '❌ NO'}`);
      
      if (file.thumbnailUrl) {
        const isValid = file.thumbnailUrl && 
                       file.thumbnailUrl.trim() !== '' &&
                       file.thumbnailUrl !== 'null' &&
                       file.thumbnailUrl !== 'undefined' &&
                       file.thumbnailUrl.startsWith('http');
        console.log(`thumbnailUrl valid: ${isValid ? '✅' : '❌'}`);
        console.log(`thumbnailUrl: ${file.thumbnailUrl}`);
        
        if (!isValid) {
          console.log(`\n⚠️ ISSUE: Invalid thumbnail URL - video will be filtered out!`);
        }
      } else {
        console.log(`\n⚠️ ISSUE: Missing thumbnail URL - video will be filtered out!`);
      }
      
      // Check if thumbnail exists in S3
      if (file.streamKey) {
        console.log(`\n📦 Checking S3 for thumbnail...`);
        try {
          const s3Files = await s3.listObjectsV2({
            Bucket: BUCKET_NAME,
            Prefix: `clips/${file.streamKey}/`,
            MaxKeys: 50
          }).promise();
          
          if (s3Files.Contents && s3Files.Contents.length > 0) {
            const thumbnails = s3Files.Contents.filter(f => f.Key.includes('_thumb.jpg'));
            if (thumbnails.length > 0) {
              const latestThumb = thumbnails.sort((a, b) => 
                b.LastModified.getTime() - a.LastModified.getTime()
              )[0];
              console.log(`   ✅ Thumbnail exists in S3: ${latestThumb.Key}`);
              console.log(`   Modified: ${latestThumb.LastModified}`);
              
              // Check if the thumbnail URL matches
              const expectedUrl = `https://d4idc5cmwxlpy.cloudfront.net/${latestThumb.Key}`;
              if (file.thumbnailUrl === expectedUrl) {
                console.log(`   ✅ Thumbnail URL matches S3 file`);
              } else {
                console.log(`   ⚠️ Thumbnail URL mismatch!`);
                console.log(`   DynamoDB: ${file.thumbnailUrl || 'null'}`);
                console.log(`   S3 file: ${expectedUrl}`);
              }
            } else {
              console.log(`   ❌ NO THUMBNAIL in S3 for streamKey: ${file.streamKey}`);
              console.log(`   → Thumbnail was never generated or uploaded`);
            }
          } else {
            console.log(`   ❌ NO FILES in S3 for streamKey: ${file.streamKey}`);
          }
        } catch (error) {
          console.log(`   ❌ Error checking S3: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error);
  }
}

checkRecentDynamoDBVideos().catch(console.error);
