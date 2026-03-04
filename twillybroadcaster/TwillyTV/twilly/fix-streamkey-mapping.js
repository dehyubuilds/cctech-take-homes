const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixStreamKeyMapping() {
  console.log('🔧 Fixing streamKey mapping for sk_0cmokm4vjmfh4nod...\n');

  const streamKey = 'sk_0cmokm4vjmfh4nod';
  const creatorId = '86326e3d-af6e-4b85-b4b9-38a5695342fc';

  // Get user profile to find email
  try {
    const userProfile = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${creatorId}`,
        SK: 'PROFILE'
      }
    }).promise();

    if (userProfile.Item) {
      const userEmail = userProfile.Item.email || userProfile.Item.userEmail;
      console.log(`✅ Found user profile:`);
      console.log(`   Email: ${userEmail || 'N/A'}`);
      console.log(`   Username: ${userProfile.Item.username || userProfile.Item.userName || 'N/A'}`);
      
      // Get channel name from old file or find it
      // Check the old file that was stored under wrong owner
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
      
      let channelName = null;
      if (oldFileQuery.Items && oldFileQuery.Items.length > 0) {
        channelName = oldFileQuery.Items[0].folderName || oldFileQuery.Items[0].seriesName;
        console.log(`   Found channel from old file: ${channelName || 'N/A'}`);
      }
      
      // Update streamKey mapping
      if (userEmail) {
        console.log(`\n🔧 Updating streamKey mapping...`);
        
        const updateParams = {
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${streamKey}`,
            SK: 'MAPPING'
          },
          UpdateExpression: 'SET collaboratorEmail = :email, channelName = :channelName',
          ExpressionAttributeValues: {
            ':email': userEmail,
            ':channelName': channelName || 'Twilly After Dark' // Default fallback
          }
        };
        
        await dynamodb.update(updateParams).promise();
        
        console.log(`✅ StreamKey mapping updated:`);
        console.log(`   collaboratorEmail: ${userEmail}`);
        console.log(`   channelName: ${channelName || 'Twilly After Dark'}`);
        console.log(`\n   Now Lambda should be able to create the file under the correct email!`);
      }
    } else {
      console.log(`❌ User profile not found for creatorId: ${creatorId}`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  console.log('\n✅ Fix complete!');
}

fixStreamKeyMapping().catch(console.error);
