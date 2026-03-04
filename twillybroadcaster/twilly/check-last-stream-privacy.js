// Check the last stream's privacy status
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function checkLastStream() {
  try {
    // Get most recent video
    const videoParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FILE#'
      },
      ScanIndexForward: false, // Most recent first
      Limit: 1
    };
    
    const videoResult = await dynamodb.query(videoParams).promise();
    
    if (!videoResult.Items || videoResult.Items.length === 0) {
      console.log('❌ No videos found');
      return;
    }
    
    const video = videoResult.Items[0];
    const streamKey = video.streamKey;
    
    console.log('='.repeat(80));
    console.log('📹 MOST RECENT VIDEO');
    console.log('='.repeat(80));
    console.log(`FileId: ${video.SK}`);
    console.log(`FileName: ${video.fileName || 'N/A'}`);
    console.log(`StreamKey: ${streamKey || 'N/A'}`);
    console.log(`Created: ${video.createdAt || video.timestamp || 'N/A'}`);
    console.log(`isPrivateUsername in video: ${video.isPrivateUsername !== undefined ? video.isPrivateUsername : 'MISSING'} (type: ${typeof video.isPrivateUsername})`);
    console.log(`Raw isPrivateUsername: ${JSON.stringify(video.isPrivateUsername)}`);
    console.log('');
    
    if (!streamKey) {
      console.log('⚠️ No streamKey found - cannot check mapping');
      return;
    }
    
    // Check streamKey mapping
    console.log('='.repeat(80));
    console.log('🔑 STREAMKEY MAPPING');
    console.log('='.repeat(80));
    const mappingParams = {
      TableName: 'Twilly',
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: 'MAPPING'
      },
      ConsistentRead: true
    };
    
    const mappingResult = await dynamodb.get(mappingParams).promise();
    
    if (!mappingResult.Item) {
      console.log('❌ StreamKey mapping NOT FOUND');
      return;
    }
    
    const mapping = mappingResult.Item;
    console.log(`StreamKey: ${streamKey}`);
    console.log(`isPrivateUsername in mapping: ${mapping.isPrivateUsername !== undefined ? mapping.isPrivateUsername : 'MISSING'} (type: ${typeof mapping.isPrivateUsername})`);
    console.log(`Raw isPrivateUsername: ${JSON.stringify(mapping.isPrivateUsername)}`);
    console.log(`Updated: ${mapping.updatedAt || mapping.createdAt || 'N/A'}`);
    console.log(`streamUsername: ${mapping.streamUsername || 'N/A'}`);
    console.log('');
    
    // Compare
    console.log('='.repeat(80));
    console.log('🔍 COMPARISON');
    console.log('='.repeat(80));
    const mappingIsPrivate = mapping.isPrivateUsername === true;
    const videoIsPrivate = video.isPrivateUsername === true;
    
    console.log(`Mapping says: ${mappingIsPrivate ? '🔒 PRIVATE' : '🔓 PUBLIC'}`);
    console.log(`Video says: ${videoIsPrivate ? '🔒 PRIVATE' : '🔓 PUBLIC'}`);
    console.log('');
    
    if (mappingIsPrivate && !videoIsPrivate) {
      console.log('❌ MISMATCH: Mapping says PRIVATE but video says PUBLIC!');
      console.log('   This is the bug - the value is not being transferred correctly.');
    } else if (!mappingIsPrivate && videoIsPrivate) {
      console.log('⚠️ MISMATCH: Mapping says PUBLIC but video says PRIVATE');
    } else if (mappingIsPrivate && videoIsPrivate) {
      console.log('✅ MATCH: Both say PRIVATE');
    } else {
      console.log('✅ MATCH: Both say PUBLIC');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

checkLastStream()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
