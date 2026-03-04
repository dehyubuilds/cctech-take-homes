import AWS from 'aws-sdk'

export default defineEventHandler(async (event) => {
  // Match existing endpoints: explicit region and credentials (note: insecure for prod)
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  })

  const dynamodb = new AWS.DynamoDB.DocumentClient()

  try {
    const body = await readBody(event)
    const { requestId, status } = body || {}

    if (!requestId || !status) {
      throw new Error('requestId and status are required')
    }

    // Find the request item by id
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'id = :id',
      ExpressionAttributeValues: { ':id': requestId }
    }
    const scanResult = await dynamodb.scan(scanParams).promise()
    if (!scanResult.Items || scanResult.Items.length === 0) {
      throw new Error('Talent request not found')
    }
    const requestItem = scanResult.Items[0]

    // Update status on the request item
    const timestamp = new Date().toISOString()
    await dynamodb.update({
      TableName: 'Twilly',
      Key: { PK: requestItem.PK, SK: requestItem.SK },
      UpdateExpression: 'SET #status = :status, updatedAt = :ts',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': status, ':ts': timestamp }
    }).promise()

    // Update in public index if present
    await dynamodb.update({
      TableName: 'Twilly',
      Key: { PK: 'PUBLIC_TALENT_REQUESTS', SK: `REQUEST#${requestId}` },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': status }
    }).promise().catch(() => {})

    return { success: true }
  } catch (error) {
    console.error('Error updating talent request status:', error)
    return { success: false, message: error.message || 'Failed to update status' }
  }
})


