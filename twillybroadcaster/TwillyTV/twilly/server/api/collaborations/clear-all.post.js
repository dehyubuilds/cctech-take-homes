import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { userId } = body

    console.log('Clear all collaborations request:', { userId })

    // Validate required fields
    if (!userId) {
      return {
        success: false,
        message: 'Missing required fields: userId'
      }
    }

    try {
      // Get all user collaborations
      const result = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'COLLABORATION#'
        }
      }).promise()

      const collaborations = result.Items || [];
      console.log('Found collaborations to delete:', collaborations.length);

      // Delete each collaboration record
      const deletePromises = collaborations.map(async (collaboration) => {
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
      });

      await Promise.all(deletePromises);

      return {
        success: true,
        message: `Cleared ${collaborations.length} collaboration records`,
        deletedCount: collaborations.length
      }

    } catch (error) {
      console.error('Error clearing collaborations:', error)
      return {
        success: false,
        message: 'Failed to clear collaboration records'
      }
    }

  } catch (error) {
    console.error('Error in clear all collaborations:', error)
    return {
      success: false,
      message: 'Internal server error'
    }
  }
}) 