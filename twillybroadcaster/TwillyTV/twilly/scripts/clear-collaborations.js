const AWS = require('aws-sdk');

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

async function clearCollaborations(userId) {
  try {
    console.log('Clearing collaborations for user:', userId);

    // Get all user collaborations
    const result = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'COLLABORATION#'
      }
    }).promise();

    const collaborations = result.Items || [];
    console.log('Found collaborations to delete:', collaborations.length);

    // Delete each collaboration record
    for (const collaboration of collaborations) {
      const channelId = collaboration.channelId;
      
      // Delete user's collaboration record
      await dynamodb.delete({
        TableName: table,
        Key: {
          PK: `USER#${userId}`,
          SK: `COLLABORATION#${channelId}`
        }
      }).promise();

      // Delete channel's collaboration record
      await dynamodb.delete({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelId}`,
          SK: `COLLABORATOR#${userId}`
        }
      }).promise();

      // Delete stream key mapping if it exists
      if (collaboration.streamKey) {
        await dynamodb.delete({
          TableName: table,
          Key: {
            PK: `STREAM_KEY#${collaboration.streamKey}`,
            SK: 'MAPPING'
          }
        }).promise();
      }

      console.log('Deleted collaboration for channel:', channelId);
    }

    console.log(`Successfully cleared ${collaborations.length} collaboration records`);

  } catch (error) {
    console.error('Error clearing collaborations:', error);
  }
}

// Run the script
const userId = process.argv[2] || 'dehsin365';
clearCollaborations(userId); 