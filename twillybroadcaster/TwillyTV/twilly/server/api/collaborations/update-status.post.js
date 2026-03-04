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
    const { requestId, status } = body

    if (!requestId || !status) {
      throw new Error('Missing requestId or status parameter')
    }

    if (!['approved', 'rejected', 'notified'].includes(status)) {
      throw new Error('Invalid status. Must be approved, rejected, or notified')
    }

    // For notified status, we'll add a notified field instead of changing status
    if (status === 'notified') {
      // First, find the request to get its current data
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
      const timestamp = new Date().toISOString()

      // Don't change the original status, just add notified field
      const updateParams = {
        TableName: 'Twilly',
        Key: {
          PK: request.PK,
          SK: request.SK
        },
        UpdateExpression: 'SET notified = :notified, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':notified': true,
          ':updatedAt': timestamp
        }
      }

      await dynamodb.update(updateParams).promise()
      console.log(`Marked request ${requestId} as notified`)

      return {
        success: true,
        message: 'Request marked as notified successfully',
        requestId,
        notified: true
      }
    }

    // First, find the request to get its current data
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
    const timestamp = new Date().toISOString()

    // Update the request with new status
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: request.PK,
        SK: request.SK
      },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': timestamp
      }
    }

    await dynamodb.update(updateParams).promise()

    console.log(`Updated request ${requestId} status to: ${status}`)

    return {
      success: true,
      message: `Request ${status} successfully`,
      requestId,
      status
    }

  } catch (error) {
    console.error('Error updating request status:', error)
    return {
      success: false,
      message: error.message || 'Failed to update request status'
    }
  }
}) 