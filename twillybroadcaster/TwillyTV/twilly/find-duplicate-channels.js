const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findDuplicateChannels() {
  console.log('🔍 Searching for duplicate Twilly TV channels...\n');
  
  try {
    // Find all channels with METADATA
    const metadataResult = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'CHANNEL#',
        ':sk': 'METADATA'
      }
    }).promise();
    
    console.log(`Found ${metadataResult.Items?.length || 0} channels with METADATA\n`);
    
    // Find all channels with OWNER
    const ownerResult = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pk) AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'CHANNEL#',
        ':sk': 'OWNER'
      }
    }).promise();
    
    console.log(`Found ${ownerResult.Items?.length || 0} channels with OWNER\n`);
    
    // Find Twilly TV channels
    const allChannels = [...(metadataResult.Items || []), ...(ownerResult.Items || [])];
    const twillyTVChannels = allChannels.filter(channel => {
      const channelName = channel.channelName || channel.series || '';
      const channelId = channel.PK ? channel.PK.replace('CHANNEL#', '') : '';
      return channelName.toLowerCase().includes('twilly tv') || 
             channelId.toLowerCase().includes('twilly tv');
    });
    
    console.log(`Found ${twillyTVChannels.length} Twilly TV channel(s):\n`);
    
    twillyTVChannels.forEach((channel, index) => {
      console.log(`[${index + 1}] PK: ${channel.PK}`);
      console.log(`   SK: ${channel.SK}`);
      console.log(`   ChannelName: ${channel.channelName || channel.series || 'MISSING'}`);
      console.log(`   CreatorEmail: ${channel.creatorEmail || 'MISSING'}`);
      console.log(`   ChannelId: ${channel.channelId || 'MISSING'}`);
      console.log(`   IsPublic: ${channel.isPublic || channel.visibility === 'public'}`);
      console.log('');
    });
    
    // Check for duplicates (same channelName but different PKs)
    const channelNameMap = new Map();
    twillyTVChannels.forEach(channel => {
      const channelName = (channel.channelName || channel.series || '').toLowerCase();
      if (!channelNameMap.has(channelName)) {
        channelNameMap.set(channelName, []);
      }
      channelNameMap.get(channelName).push(channel);
    });
    
    console.log('\n📊 Duplicate Analysis:\n');
    channelNameMap.forEach((channels, channelName) => {
      if (channels.length > 1) {
        console.log(`⚠️ DUPLICATE: "${channelName}" appears ${channels.length} times:`);
        channels.forEach((channel, idx) => {
          console.log(`   [${idx + 1}] PK: ${channel.PK}, SK: ${channel.SK}`);
        });
        console.log('');
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findDuplicateChannels().catch(console.error);
