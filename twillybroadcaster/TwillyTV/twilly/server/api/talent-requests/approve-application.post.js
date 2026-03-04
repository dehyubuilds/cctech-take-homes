import AWS from 'aws-sdk'

export default defineEventHandler(async (event) => {
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  })

  const dynamodb = new AWS.DynamoDB.DocumentClient()

  try {
    const body = await readBody(event)
    const { requestId, applicationId } = body || {}

    if (!requestId || !applicationId) {
      throw new Error('requestId and applicationId are required')
    }

    // Update the application status
    const timestamp = new Date().toISOString()
    await dynamodb.update({
      TableName: 'Twilly',
      Key: { PK: `TALENT_REQUEST#${requestId}`, SK: `APPLICATION#${applicationId}` },
      UpdateExpression: 'SET #status = :status, updatedAt = :ts',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'approved', ':ts': timestamp }
    }).promise()

    // Also update the status inside the parent request's aggregated applications array if it exists
    const scanParams = { TableName: 'Twilly', FilterExpression: 'id = :id', ExpressionAttributeValues: { ':id': requestId } }
    const scanResult = await dynamodb.scan(scanParams).promise()
    if (scanResult.Items && scanResult.Items.length > 0) {
      const parent = scanResult.Items[0]
      const apps = Array.isArray(parent.applications) ? parent.applications : []
      const idx = apps.findIndex(a => a.applicationId === applicationId)
      if (idx !== -1) {
        apps[idx].status = 'approved'
        apps[idx].updatedAt = timestamp
        await dynamodb.update({
          TableName: 'Twilly',
          Key: { PK: parent.PK, SK: parent.SK },
          UpdateExpression: 'SET applications = :apps, updatedAt = :ts',
          ExpressionAttributeValues: { ':apps': apps, ':ts': timestamp }
        }).promise()
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error approving application:', error)
    return { success: false, message: error.message || 'Failed to approve application' }
  }
})


