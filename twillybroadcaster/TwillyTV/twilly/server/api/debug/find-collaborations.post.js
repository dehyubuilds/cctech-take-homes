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
    const { email } = body

    console.log('Find collaborations for email:', email)

    // Scan for collaborations with this email
    try {
      const result = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'userEmail = :email OR userId = :email',
        ExpressionAttributeValues: {
          ':email': email
        }
      }).promise()

      const collaborations = result.Items || [];
      console.log('Found collaborations in scan:', collaborations.length);

      // Also try to find by channel collaborator records
      const channelResult = await dynamodb.scan({
        TableName: table,
        FilterExpression: 'userEmail = :email OR userId = :email',
        ExpressionAttributeValues: {
          ':email': email
        }
      }).promise()

      const channelCollaborations = channelResult.Items || [];
      console.log('Found channel collaborations in scan:', channelCollaborations.length);

      return {
        success: true,
        message: 'Collaborations found',
        collaborations: collaborations,
        channelCollaborations: channelCollaborations,
        totalFound: collaborations.length + channelCollaborations.length
      }

    } catch (error) {
      console.error('Error scanning collaborations:', error)
      return {
        success: false,
        message: 'Failed to scan collaborations'
      }
    }

  } catch (error) {
    console.error('Error in find collaborations:', error)
    return {
      success: false,
      message: 'Internal server error'
    }
  }
}) 