const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function addMissingStreamKey() {
  try {
    const streamKey = 'sk_978neo2cghpe42fq';
    const userEmail = 'dehyu.sinyan@gmail.com';
    const channelName = 'Twilly';
    
    // Check if stream key already exists
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'streamKey = :streamKey',
      ExpressionAttributeValues: {
        ':streamKey': streamKey
      }
    };

    const existingKeys = await dynamodb.scan(scanParams).promise();
    
    if (existingKeys.Items && existingKeys.Items.length > 0) {
      console.log('Stream key already exists:', existingKeys.Items);
      return;
    }

    // Get the next key number for this user/channel
    const queryParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk',
      FilterExpression: 'channelName = :channelName AND ownerEmail = :userEmail',
      ExpressionAttributeValues: {
        ':pk': `STREAM_KEY#${userEmail}`,
        ':channelName': channelName,
        ':userEmail': userEmail
      }
    };

    const existingKeysResult = await dynamodb.query(queryParams).promise();
    let maxKeyNumber = 0;
    
    if (existingKeysResult.Items && existingKeysResult.Items.length > 0) {
      maxKeyNumber = Math.max(
        ...existingKeysResult.Items.map(item => parseInt(item.keyNumber || '0'))
      );
    }
    
    const newKeyNumber = maxKeyNumber + 1;

    // Create the stream key record
    const streamKeyRecord = {
      PK: `STREAM_KEY#${userEmail}`,
      SK: streamKey,
      streamKey: streamKey,
      ownerEmail: userEmail,
      channelName: channelName,
      creatorId: userEmail,
      channelId: `channel_${channelName.toLowerCase().replace(/\s+/g, '_')}`,
      isActive: true,
      createdAt: new Date().toISOString(),
      keyNumber: newKeyNumber,
      status: 'ACTIVE'
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: streamKeyRecord
    }).promise();

    console.log('Successfully added missing stream key:', {
      streamKey,
      userEmail,
      channelName,
      keyNumber: newKeyNumber
    });

  } catch (error) {
    console.error('Error adding missing stream key:', error);
  }
}

addMissingStreamKey(); 