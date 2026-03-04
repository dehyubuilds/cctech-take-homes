const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1',
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function fixLastStreamLocation() {
  console.log('🔧 Fixing last stream location...\n');
  
  try {
    // Find the most recent video
    const allFilesScan = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pkPrefix) AND begins_with(SK, :skPrefix) AND category = :category',
      ExpressionAttributeValues: {
        ':pkPrefix': 'USER#',
        ':skPrefix': 'FILE#',
        ':category': 'Videos'
      }
    }).promise();

    if (!allFilesScan.Items || allFilesScan.Items.length === 0) {
      console.log('❌ No videos found');
      return;
    }

    // Sort by timestamp (newest first)
    const sortedFiles = allFilesScan.Items
      .filter(f => f.createdAt || f.timestamp)
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || a.timestamp || 0).getTime();
        const bTime = new Date(b.createdAt || b.timestamp || 0).getTime();
        return bTime - aTime;
      });

    const latestVideo = sortedFiles[0];
    const currentOwnerEmail = latestVideo.PK.replace('USER#', '');
    const channelName = latestVideo.folderName || latestVideo.seriesName;
    const streamKey = latestVideo.streamKey;
    
    console.log('📹 MOST RECENT VIDEO:');
    console.log('='.repeat(70));
    console.log(`fileName: ${latestVideo.fileName || 'MISSING'}`);
    console.log(`streamKey: ${streamKey || 'MISSING'}`);
    console.log(`channelName: ${channelName || 'MISSING'}`);
    console.log(`Currently stored under: ${currentOwnerEmail}`);
    console.log('');

    // Find channel owner
    let channelOwnerEmail = null;
    
    if (channelName === 'Twilly TV') {
      channelOwnerEmail = 'dehyu.sinyan@gmail.com';
      console.log(`✅ Using known owner for Twilly TV: ${channelOwnerEmail}`);
    } else {
      // Try to find channel owner
      try {
        const channelScan = await dynamodb.scan({
          TableName: table,
          FilterExpression: 'begins_with(PK, :pkPrefix) AND channelName = :channelName AND #role = :role',
          ExpressionAttributeNames: {
            '#role': 'role'
          },
          ExpressionAttributeValues: {
            ':pkPrefix': 'CHANNEL#',
            ':channelName': channelName,
            ':role': 'owner'
          }
        }).promise();

        if (channelScan.Items && channelScan.Items.length > 0) {
          channelOwnerEmail = channelScan.Items[0].creatorEmail || channelScan.Items[0].userEmail;
          console.log(`✅ Found channel owner: ${channelOwnerEmail}`);
        }
      } catch (error) {
        console.error(`❌ Error finding channel owner: ${error.message}`);
      }
    }

    if (!channelOwnerEmail) {
      console.log('❌ Could not determine channel owner. Cannot fix.');
      return;
    }

    if (currentOwnerEmail === channelOwnerEmail) {
      console.log('✅ Video is already stored under the correct account.');
      return;
    }

    console.log(`\n🔧 MOVING VIDEO FROM ${currentOwnerEmail} TO ${channelOwnerEmail}`);
    console.log('='.repeat(70));

    // Check if video already exists under master account
    const checkParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `USER#${channelOwnerEmail}`,
        ':sk': latestVideo.SK
      }
    };

    const existingCheck = await dynamodb.query(checkParams).promise();
    
    if (existingCheck.Items && existingCheck.Items.length > 0) {
      console.log('⚠️ Video already exists under master account. Updating instead of moving...');
      
      // Update the existing entry with latest data
      const updatedItem = {
        ...latestVideo,
        PK: `USER#${channelOwnerEmail}`
      };
      
      await dynamodb.put({
        TableName: table,
        Item: updatedItem
      }).promise();
      
      console.log('✅ Updated video under master account');
    } else {
      // Create new entry under master account
      const newItem = {
        ...latestVideo,
        PK: `USER#${channelOwnerEmail}`
      };
      
      await dynamodb.put({
        TableName: table,
        Item: newItem
      }).promise();
      
      console.log('✅ Created video entry under master account');
    }

    // Delete old entry
    console.log(`🗑️ Deleting old entry from ${currentOwnerEmail}...`);
    await dynamodb.delete({
      TableName: table,
      Key: {
        PK: latestVideo.PK,
        SK: latestVideo.SK
      }
    }).promise();
    
    console.log('✅ Deleted old entry');
    console.log('\n✅ Video has been moved to master account!');
    console.log(`   It should now appear in get-content API for channel: ${channelName}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixLastStreamLocation().catch(console.error);
