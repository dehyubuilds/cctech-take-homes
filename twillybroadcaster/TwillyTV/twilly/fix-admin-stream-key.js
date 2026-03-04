const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixAdminStreamKey() {
  console.log('🔍 Finding admin stream key for Twilly TV...\n');
  
  try {
    const adminEmail = 'dehyu.sinyan@gmail.com';
    const channelName = 'Twilly TV';
    
    // Find all stream keys for Twilly TV channel
    const streamKeys = [];
    let lastEvaluatedKey = null;
    
    do {
      const params = {
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND (channelName = :channelName OR seriesName = :channelName)',
        ExpressionAttributeValues: {
          ':pkPrefix': 'STREAM_KEY#',
          ':channelName': channelName
        }
      };
      
      if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const result = await dynamodb.scan(params).promise();
      
      if (result.Items) {
        streamKeys.push(...result.Items);
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`Found ${streamKeys.length} stream keys for Twilly TV\n`);
    
    // Find admin's stream key
    const adminStreamKey = streamKeys.find(sk => 
      (sk.ownerEmail === adminEmail || sk.collaboratorEmail === adminEmail) &&
      (sk.channelName === channelName || sk.seriesName === channelName)
    );
    
    if (adminStreamKey) {
      const streamKeyValue = adminStreamKey.PK.replace('STREAM_KEY#', '');
      console.log('✅ ADMIN STREAM KEY FOUND:');
      console.log('='.repeat(60));
      console.log(`Stream Key: ${streamKeyValue}`);
      console.log(`PK: ${adminStreamKey.PK}`);
      console.log(`SK: ${adminStreamKey.SK}`);
      console.log(`ownerEmail: ${adminStreamKey.ownerEmail || 'MISSING'}`);
      console.log(`collaboratorEmail: ${adminStreamKey.collaboratorEmail || 'MISSING'}`);
      console.log(`isCollaboratorKey: ${adminStreamKey.isCollaboratorKey || false}`);
      console.log(`channelName: ${adminStreamKey.channelName || adminStreamKey.seriesName || 'MISSING'}`);
      console.log(`creatorId: ${adminStreamKey.creatorId || 'MISSING'}`);
      console.log('');
      
      // Check if admin should use this key or create a new one
      if (adminStreamKey.isCollaboratorKey && adminStreamKey.collaboratorEmail === adminEmail) {
        console.log('✅ This is the correct stream key for admin');
      } else if (adminStreamKey.ownerEmail === adminEmail && !adminStreamKey.isCollaboratorKey) {
        console.log('⚠️ This is an owner key, but admin should use a collaborator key for Twilly TV');
      }
    } else {
      console.log('❌ No stream key found for admin in Twilly TV channel');
      console.log('\n📋 All stream keys found:');
      streamKeys.forEach((sk, index) => {
        const streamKeyValue = sk.PK.replace('STREAM_KEY#', '');
        console.log(`\n${index + 1}. Stream Key: ${streamKeyValue}`);
        console.log(`   ownerEmail: ${sk.ownerEmail || 'MISSING'}`);
        console.log(`   collaboratorEmail: ${sk.collaboratorEmail || 'MISSING'}`);
        console.log(`   isCollaboratorKey: ${sk.isCollaboratorKey || false}`);
      });
    }
    
    // Check the problematic stream key
    const problematicKey = 'sk_ikgqum1e70nc4tyl';
    console.log(`\n🔍 Checking problematic key: ${problematicKey}`);
    const problematicMapping = streamKeys.find(sk => sk.PK === `STREAM_KEY#${problematicKey}`);
    if (problematicMapping) {
      console.log('   This key belongs to:');
      console.log(`   - collaboratorEmail: ${problematicMapping.collaboratorEmail || 'MISSING'}`);
      console.log(`   - ownerEmail: ${problematicMapping.ownerEmail || 'MISSING'}`);
      console.log(`   - isCollaboratorKey: ${problematicMapping.isCollaboratorKey || false}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixAdminStreamKey().catch(console.error);
