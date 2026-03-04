import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function backfillIsPrivateUsername() {
  try {
    console.log('🔍 Scanning for videos in Twilly TV...');
    
    // Get all videos in Twilly TV (under admin account)
    const adminEmail = 'dehyu.sinyan@gmail.com';
    const result = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${adminEmail}`,
        ':sk': 'FILE#'
      },
      FilterExpression: 'folderName = :folderName',
      ExpressionAttributeValues: {
        ':pk': `USER#${adminEmail}`,
        ':sk': 'FILE#',
        ':folderName': 'Twilly TV'
      }
    }).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log('⚠️ No videos found');
      return;
    }
    
    console.log(`📹 Found ${result.Items.length} videos`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const video of result.Items) {
      if (!video.streamKey) {
        console.log(`⚠️ Skipping video ${video.fileName || video.SK} - no streamKey`);
        skipped++;
        continue;
      }
      
      // Check if isPrivateUsername is already set
      if (video.isPrivateUsername !== undefined && video.isPrivateUsername !== null) {
        console.log(`⏭️ Skipping video ${video.fileName || video.SK} - isPrivateUsername already set: ${video.isPrivateUsername}`);
        skipped++;
        continue;
      }
      
      // Get streamKey mapping
      const mappingResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `STREAM_KEY#${video.streamKey}`,
          SK: 'MAPPING'
        }
      }).promise();
      
      if (!mappingResult.Item) {
        console.log(`⚠️ No streamKey mapping found for ${video.streamKey}`);
        skipped++;
        continue;
      }
      
      const isPrivateUsername = mappingResult.Item.isPrivateUsername === true || 
                                mappingResult.Item.isPrivateUsername === 'true' || 
                                mappingResult.Item.isPrivateUsername === 1;
      
      if (isPrivateUsername) {
        // Update video entry
        try {
          await dynamodb.update({
            TableName: table,
            Key: {
              PK: video.PK,
              SK: video.SK
            },
            UpdateExpression: 'SET isPrivateUsername = :isPrivate',
            ExpressionAttributeValues: {
              ':isPrivate': true
            }
          }).promise();
          console.log(`✅ Updated ${video.fileName || video.SK} - set isPrivateUsername: true`);
          updated++;
        } catch (error) {
          console.error(`❌ Error updating ${video.fileName || video.SK}: ${error.message}`);
          errors++;
        }
      } else {
        console.log(`⏭️ Skipping ${video.fileName || video.SK} - streamKey mapping has isPrivateUsername: ${mappingResult.Item.isPrivateUsername}`);
        skipped++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

backfillIsPrivateUsername();
