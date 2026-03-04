import AWS from 'aws-sdk'

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient()

  try {
    const body = await readBody(event)
    const { requestId } = body

    if (!requestId) {
      throw new Error('Missing requestId parameter')
    }

    // First, find the request to get its PK/SK
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'requestId = :requestId',
      ExpressionAttributeValues: {
        ':requestId': requestId
      }
    }

    const scanResult = await dynamodb.scan(scanParams).promise()
    
    if (!scanResult.Items || scanResult.Items.length === 0) {
      throw new Error('Request not found')
    }

    const request = scanResult.Items[0]

    // Delete the request from DynamoDB
    const deleteParams = {
      TableName: 'Twilly',
      Key: {
        PK: request.PK,
        SK: request.SK
      }
    }

    await dynamodb.delete(deleteParams).promise()

    console.log(`Deleted request ${requestId} from database`)

    return {
      success: true,
      message: 'Request deleted successfully',
      requestId
    }

  } catch (error) {
    console.error('Error deleting request:', error)
    return {
      success: false,
      message: error.message || 'Failed to delete request'
    }
  }
}) 