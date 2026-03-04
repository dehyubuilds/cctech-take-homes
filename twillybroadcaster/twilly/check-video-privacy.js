// Check privacy status of recent videos
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function checkVideoPrivacy(uploadId, videoName) {
  try {
    const params = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'contains(fileName, :uploadId)',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FILE#',
        ':uploadId': uploadId
      }
    };
    
    const result = await dynamodb.query(params).promise();
    
    if (!result.Items || result.Items.length === 0) {
      console.log(`❌ ${videoName}: Not found`);
      return;
    }
    
    const item = result.Items[0];
    const isPrivate = item.isPrivateUsername;
    
    console.log(`\n📹 ${videoName}:`);
    console.log(`   UploadId: ${uploadId}`);
    console.log(`   FileName: ${item.fileName || 'N/A'}`);
    console.log(`   Created: ${item.createdAt || item.timestamp || 'N/A'}`);
    console.log(`   StreamKey: ${item.streamKey || 'N/A'}`);
    console.log(`   streamUsername: ${item.streamUsername || 'N/A'}`);
    console.log(`   isPrivateUsername: ${isPrivate !== undefined ? isPrivate : 'MISSING'} (type: ${typeof isPrivate})`);
    console.log(`   Status: ${isPrivate === true ? '🔒 PRIVATE' : isPrivate === false ? '🔓 PUBLIC' : '⚠️  UNKNOWN (defaults to PUBLIC)'}`);
    
    // Also check streamKey mapping
    if (item.streamKey) {
      try {
        const mappingResult = await dynamodb.get({
          TableName: 'Twilly',
          Key: {
            PK: `STREAM_KEY#${item.streamKey}`,
            SK: 'MAPPING'
          }
        }).promise();
        
        if (mappingResult.Item) {
          const mappingIsPrivate = mappingResult.Item.isPrivateUsername;
          const mappingStreamUsername = mappingResult.Item.streamUsername;
          console.log(`   StreamKey Mapping:`);
          console.log(`     isPrivateUsername: ${mappingIsPrivate !== undefined ? mappingIsPrivate : 'MISSING'}`);
          console.log(`     streamUsername: ${mappingStreamUsername || 'N/A'}`);
          if (mappingStreamUsername && mappingStreamUsername.includes('🔒')) {
            console.log(`     ⚠️  Lock icon detected in streamUsername - indicates PRIVATE`);
          }
        } else {
          console.log(`   StreamKey Mapping: NOT FOUND`);
        }
      } catch (mappingError) {
        console.log(`   StreamKey Mapping: Error - ${mappingError.message}`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Error checking ${videoName}:`, error.message);
  }
}

async function main() {
  console.log('🔍 Checking privacy status of last 2 videos...\n');
  console.log('='.repeat(80));
  
  await checkVideoPrivacy('omc1tlj9', '15-minute video');
  await checkVideoPrivacy('de1rlm09', '5-6 minute video');
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Check complete');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
