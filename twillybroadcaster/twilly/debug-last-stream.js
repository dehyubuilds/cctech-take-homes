// Debug the last stream to see what went wrong
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function debugLastStream() {
  try {
    // Get most recent video
    const videoParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'USER#dehyu.sinyan@gmail.com',
        ':sk': 'FILE#'
      },
      ScanIndexForward: false,
      Limit: 1
    };
    
    const videoResult = await dynamodb.query(videoParams).promise();
    
    if (!videoResult.Items || videoResult.Items.length === 0) {
      console.log('❌ No videos found');
      return;
    }
    
    const video = videoResult.Items[0];
    const streamKey = video.streamKey;
    const fileId = video.SK.replace('FILE#', '');
    
    console.log('='.repeat(80));
    console.log('📹 MOST RECENT VIDEO');
    console.log('='.repeat(80));
    console.log(`FileId: ${fileId}`);
    console.log(`FileName: ${video.fileName || 'N/A'}`);
    console.log(`StreamKey: ${streamKey || 'N/A'}`);
    console.log(`Created: ${video.createdAt || video.timestamp || 'N/A'}`);
    console.log(`isPrivateUsername: ${video.isPrivateUsername !== undefined ? video.isPrivateUsername : 'MISSING'} (type: ${typeof video.isPrivateUsername})`);
    console.log(`Raw isPrivateUsername: ${JSON.stringify(video.isPrivateUsername)}`);
    console.log('');
    
    if (!streamKey) {
      console.log('⚠️ No streamKey found');
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
    
    // Check when video was created vs when mapping was updated
    const videoCreated = new Date(video.createdAt || video.timestamp);
    const mappingUpdated = new Date(mapping.updatedAt || mapping.createdAt);
    console.log('='.repeat(80));
    console.log('⏰ TIMING ANALYSIS');
    console.log('='.repeat(80));
    console.log(`Video created: ${videoCreated.toISOString()}`);
    console.log(`Mapping updated: ${mappingUpdated.toISOString()}`);
    console.log(`Time difference: ${Math.abs(videoCreated - mappingUpdated) / 1000} seconds`);
    if (mappingUpdated > videoCreated) {
      console.log('⚠️ Mapping was updated AFTER video was created!');
      console.log('   This means setStreamUsernameType was called after createVideoEntryImmediately');
    } else {
      console.log('✅ Mapping was updated BEFORE video was created');
    }
    console.log('');
    
    // Final comparison
    console.log('='.repeat(80));
    console.log('🔍 FINAL COMPARISON');
    console.log('='.repeat(80));
    const mappingIsPrivate = mapping.isPrivateUsername === true;
    const videoIsPrivate = video.isPrivateUsername === true;
    
    console.log(`Mapping says: ${mappingIsPrivate ? '🔒 PRIVATE' : '🔓 PUBLIC'}`);
    console.log(`Video says: ${videoIsPrivate ? '🔒 PRIVATE' : '🔓 PUBLIC'}`);
    console.log('');
    
    if (mappingIsPrivate && !videoIsPrivate) {
      console.log('❌ BUG CONFIRMED: Mapping says PRIVATE but video says PUBLIC!');
      console.log('');
      console.log('🔍 ROOT CAUSE ANALYSIS:');
      console.log('   1. User selected PRIVATE ✅');
      console.log('   2. setStreamUsernameType set mapping to PRIVATE ✅');
      console.log('   3. createVideoEntryImmediately read mapping ❌ (might have failed)');
      console.log('   4. Lambda UpdateItemCommand ❌ (might have overwritten it)');
      console.log('');
      console.log('💡 POSSIBLE ISSUES:');
      console.log('   - createVideoEntryImmediately might have read mapping BEFORE setStreamUsernameType completed');
      console.log('   - Lambda UpdateItemCommand might have a bug in the condition check');
      console.log('   - The UpdateExpression might not be preserving the field correctly');
    } else if (!mappingIsPrivate && videoIsPrivate) {
      console.log('⚠️ Mapping says PUBLIC but video says PRIVATE (unexpected)');
    } else if (mappingIsPrivate && videoIsPrivate) {
      console.log('✅ Both say PRIVATE - but user says it shows in public view');
      console.log('   This means the filtering logic in get-content.post.js might be broken');
    } else {
      console.log('✅ Both say PUBLIC - user selected public');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

debugLastStream()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
