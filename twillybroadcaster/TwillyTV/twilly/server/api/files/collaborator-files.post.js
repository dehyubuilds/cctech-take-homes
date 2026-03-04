import AWS from 'aws-sdk';

// Configure AWS SDK
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { userEmail, channelName } = body;

    if (!userEmail || !channelName) {
      return {
        success: false,
        message: 'Missing required fields: userEmail and channelName'
      };
    }

    console.log(`Getting collaborator files for ${userEmail} in channel ${channelName}`);

    // Get the master account email for this channel
    const MASTER_EMAILS = ['dehyu.sinyan@gmail.com'];
    const MASTER_USERNAMES = ['DehSin365'];
    
    // Get username from DynamoDB
    let username = '';
    try {
      const userResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'PROFILE'
        }
      }).promise();
      
      if (userResult.Item) {
        username = userResult.Item.username || '';
      }
    } catch (error) {
      console.error('Error fetching username:', error);
    }

    const isMaster = MASTER_EMAILS.includes(userEmail) || MASTER_USERNAMES.includes(username);
    
    // If this is the master account, return all files for the channel
    if (isMaster) {
      console.log('User is master account, returning all files');
      
      const masterResult = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: 'folderName = :channelName',
        ExpressionAttributeValues: {
          ':pk': `USER#${userEmail}`,
          ':sk': 'FILE#',
          ':channelName': channelName
        }
      }).promise();

      return {
        success: true,
        files: masterResult.Items || [],
        isMaster: true
      };
    }

    // For collaborators, get their stream keys for this channel
    // Query all stream key mappings to find ones belonging to this user
    const streamKeysResult = await dynamodb.scan({
      TableName: table,
      FilterExpression: 'begins_with(PK, :pk) AND seriesName = :channelName AND (ownerEmail = :userEmail OR creatorId = :userEmail)',
      ExpressionAttributeValues: {
        ':pk': 'STREAM_KEY#',
        ':channelName': channelName,
        ':userEmail': userEmail
      }
    }).promise();

    const userStreamKeys = streamKeysResult?.Items?.map(item => item.streamKey) || [];
    console.log(`Found ${userStreamKeys.length} stream keys for collaborator:`, userStreamKeys);

    if (userStreamKeys.length === 0) {
      return {
        success: true,
        files: [],
        isMaster: false,
        message: 'No stream keys found for this channel'
      };
    }

    // Get the master account email (hardcoded for now)
    const masterEmail = 'dehyu.sinyan@gmail.com';

    // Query master account's files for this channel
    const masterFilesResult = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'folderName = :channelName',
      ExpressionAttributeValues: {
        ':pk': `USER#${masterEmail}`,
        ':sk': 'FILE#',
        ':channelName': channelName
      }
    }).promise();

    // Filter files to only show those streamed with the collaborator's keys
    const collaboratorFiles = (masterFilesResult.Items || []).filter(file => {
      return userStreamKeys.includes(file.streamKey);
    });

    console.log(`Found ${collaboratorFiles.length} files for collaborator out of ${masterFilesResult.Items?.length || 0} total files`);

    return {
      success: true,
      files: collaboratorFiles,
      isMaster: false,
      totalFiles: masterFilesResult.Items?.length || 0,
      collaboratorFiles: collaboratorFiles.length
    };

  } catch (error) {
    console.error('Error getting collaborator files:', error);
    return {
      success: false,
      message: 'Failed to get collaborator files',
      error: error.message
    };
  }
});
