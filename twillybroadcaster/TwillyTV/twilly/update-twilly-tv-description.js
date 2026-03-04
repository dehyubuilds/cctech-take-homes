/**
 * Script to update Twilly TV channel description in DynamoDB
 * 
 * Usage:
 *  node update-twilly-tv-description.js "Your new description here"
 */

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '81v8RfOXhFHoKvOyD5t4I8kIeaVq9ad9TSAnp7eI'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

// Twilly TV channel info
const TWILLY_TV_EMAIL = 'dehyu.sinyan@gmail.com';
const TWILLY_TV_CHANNEL_NAME = 'Twilly TV';

const NEW_DESCRIPTION = 'Your personalized streaming network. Add creators you love, curate your timeline, and watch content that matters to you.';

async function findTwillyTVChannel() {
  console.log('🔍 Finding Twilly TV channel...');
  
  // Try CHANNEL#METADATA structure first
  const channelId = `${TWILLY_TV_EMAIL}-${TWILLY_TV_CHANNEL_NAME}`;
  const channelKey = {
    PK: `CHANNEL#${channelId}`,
    SK: 'METADATA'
  };
  
  try {
    const result = await dynamodb.get({
      TableName: table,
      Key: channelKey
    }).promise();
    
    if (result.Item) {
      console.log('✅ Found channel with METADATA structure');
      return { item: result.Item, key: channelKey };
    }
  } catch (error) {
    console.log('⚠️ METADATA structure not found, trying OWNER...');
  }
  
  // Try CHANNEL#OWNER structure
  const ownerKey = {
    PK: `CHANNEL#${channelId}`,
    SK: 'OWNER'
  };
  
  try {
    const result = await dynamodb.get({
      TableName: table,
      Key: ownerKey
    }).promise();
    
    if (result.Item) {
      console.log('✅ Found channel with OWNER structure');
      return { item: result.Item, key: ownerKey };
    }
  } catch (error) {
    console.log('⚠️ OWNER structure not found, trying scan...');
  }
  
  // Try scanning for channel
  const scanParams = {
    TableName: table,
    FilterExpression: 'begins_with(PK, :pk) AND (channelName = :channelName OR #name = :channelName OR series = :channelName)',
    ExpressionAttributeNames: {
      '#name': 'name'
    },
    ExpressionAttributeValues: {
      ':pk': 'CHANNEL#',
      ':channelName': TWILLY_TV_CHANNEL_NAME
    }
  };
  
  const scanResult = await dynamodb.scan(scanParams).promise();
  if (scanResult.Items && scanResult.Items.length > 0) {
    const channel = scanResult.Items[0];
    const key = {
      PK: channel.PK,
      SK: channel.SK
    };
    console.log('✅ Found channel via scan');
    return { item: channel, key };
  }
  
  return null;
}

async function findTwillyTVFolder() {
  console.log('🔍 Also checking for FOLDER record...');
  
  const queryParams = {
    TableName: table,
    KeyConditionExpression: 'PK = :pk',
    FilterExpression: '#name = :channelName OR folderName = :channelName OR series = :channelName',
    ExpressionAttributeNames: {
      '#name': 'name'
    },
    ExpressionAttributeValues: {
      ':pk': `USER#${TWILLY_TV_EMAIL}`,
      ':channelName': TWILLY_TV_CHANNEL_NAME
    }
  };

  const result = await dynamodb.query(queryParams).promise();
  
  // Look for FOLDER records
  const folders = result.Items?.filter(item => 
    item.SK?.startsWith('FOLDER#') || item.SK?.startsWith('COLLAB#')
  ) || [];

  if (folders.length === 0) {
    // Try scanning for folder
    const scanParams = {
      TableName: table,
      FilterExpression: 'PK = :pk AND (#name = :channelName OR folderName = :channelName OR series = :channelName)',
      ExpressionAttributeNames: {
        '#name': 'name'
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${TWILLY_TV_EMAIL}`,
        ':channelName': TWILLY_TV_CHANNEL_NAME
      }
    };
    
    const scanResult = await dynamodb.scan(scanParams).promise();
    return scanResult.Items?.find(item => 
      item.SK?.startsWith('FOLDER#') || item.SK?.startsWith('COLLAB#')
    );
  }

  return folders[0];
}

async function updateDescription(newDescription) {
  console.log('📝 Updating Twilly TV description...');
  
  const channel = await findTwillyTVChannel();
  
  if (!channel) {
    console.error('❌ Twilly TV channel not found!');
    console.log('💡 The channel may need to be created first.');
    return;
  }

  console.log('✅ Found channel:', {
    PK: channel.key.PK,
    SK: channel.key.SK,
    currentDescription: channel.item.description || '(none)'
  });

  // Update the channel description
  const updateParams = {
    TableName: table,
    Key: channel.key,
    UpdateExpression: 'SET description = :description, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':description': newDescription.trim(),
      ':updatedAt': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };

  try {
    const result = await dynamodb.update(updateParams).promise();
    console.log('✅ Channel description updated successfully!');
    console.log('📝 New description:', result.Attributes.description);
    
    // Also update FOLDER record if it exists
    const folder = await findTwillyTVFolder();
    if (folder) {
      console.log('✅ Found FOLDER record, updating description there too...');
      const folderUpdateParams = {
        TableName: table,
        Key: {
          PK: folder.PK,
          SK: folder.SK
        },
        UpdateExpression: 'SET description = :description, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':description': newDescription.trim(),
          ':updatedAt': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      };
      
      const folderResult = await dynamodb.update(folderUpdateParams).promise();
      console.log('✅ FOLDER description updated successfully!');
    } else {
      console.log('ℹ️ No FOLDER record found (this is okay)');
    }
    
    return result.Attributes;
  } catch (error) {
    console.error('❌ Error updating description:', error);
    throw error;
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📝 Twilly TV Description Update Script

Usage:
  node update-twilly-tv-description.js "Your new description here"

Example:
  node update-twilly-tv-description.js "Your personalized streaming network. Add creators you love, curate your timeline, and watch content that matters to you."

If no description is provided, will use default:
  "${NEW_DESCRIPTION}"
    `);
    
    // Use default description
    await updateDescription(NEW_DESCRIPTION);
    return;
  }

  try {
    const newDescription = args.join(' ');
    await updateDescription(newDescription);
    
    console.log('\n✅ Done! Twilly TV description has been updated.');
    console.log('🔄 The new description should appear in the app after a refresh.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { updateDescription, findTwillyTVChannel };
