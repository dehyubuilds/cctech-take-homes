const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function findUser() {
  const creatorId = '86326e3d-af6e-4b85-b4b9-38a5695342fc';
  const streamKey = 'sk_0cmokm4vjmfh4nod';

  console.log(`🔍 Finding user for creatorId: ${creatorId}\n`);

  // Try USER#userId format
  try {
    const userProfile = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `USER#${creatorId}`,
        SK: 'PROFILE'
      }
    }).promise();

    if (userProfile.Item) {
      console.log(`✅ Found user profile:`);
      console.log(`   Email: ${userProfile.Item.email || userProfile.Item.userEmail || 'N/A'}`);
      console.log(`   Username: ${userProfile.Item.username || userProfile.Item.userName || 'N/A'}`);
      
      const userEmail = userProfile.Item.email || userProfile.Item.userEmail;
      
      if (userEmail) {
        // Update streamKey mapping
        console.log(`\n🔧 Updating streamKey mapping...`);
        
        // First, get the current mapping to see what channelName should be
        const currentMapping = await dynamodb.get({
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${streamKey}`,
            SK: 'MAPPING'
          }
        }).promise();
        
        let channelName = 'Twilly After Dark'; // Default
        if (currentMapping.Item) {
          // Check if there's a channelName in an old file
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
            channelName = oldFileQuery.Items[0].folderName || oldFileQuery.Items[0].seriesName || 'Twilly After Dark';
          }
        }
        
        const updateParams = {
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${streamKey}`,
            SK: 'MAPPING'
          },
          UpdateExpression: 'SET collaboratorEmail = :email, channelName = :channelName',
          ExpressionAttributeValues: {
            ':email': userEmail,
            ':channelName': channelName
          }
        };
        
        await dynamodb.update(updateParams).promise();
        
        console.log(`✅ StreamKey mapping updated:`);
        console.log(`   collaboratorEmail: ${userEmail}`);
        console.log(`   channelName: ${channelName}`);
      }
    } else {
      console.log(`❌ User profile not found for creatorId: ${creatorId}`);
      
      // Try searching by email patterns
      console.log(`\n🔍 Searching for user by scanning...`);
      const scanResult = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'begins_with(PK, :pkPrefix) AND SK = :sk',
        ExpressionAttributeValues: {
          ':pkPrefix': 'USER#',
          ':sk': 'PROFILE'
        }
      }).promise();
      
      if (scanResult.Items) {
        const matchingUser = scanResult.Items.find(item => {
          return item.userId === creatorId || item.id === creatorId;
        });
        
        if (matchingUser) {
          console.log(`✅ Found user by scanning:`);
          console.log(`   Email: ${matchingUser.email || matchingUser.userEmail || 'N/A'}`);
          console.log(`   Username: ${matchingUser.username || matchingUser.userName || 'N/A'}`);
        } else {
          console.log(`❌ User not found in scan either`);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error:`, error.message);
  }

  console.log('\n✅ Check complete!');
}

findUser().catch(console.error);
