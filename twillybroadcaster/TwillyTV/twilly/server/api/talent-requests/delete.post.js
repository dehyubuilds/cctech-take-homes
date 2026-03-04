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
    console.log('Delete API - Received body:', body)
    const { requestId } = body || {}

    if (!requestId) {
      console.log('Delete API - No requestId provided in body:', body)
      throw new Error('requestId is required')
    }
    
    console.log('Delete API - Deleting request with ID:', requestId)

    // Find the request
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

    // Delete request
    await dynamodb.delete({
      TableName: 'Twilly',
      Key: { PK: requestItem.PK, SK: requestItem.SK }
    }).promise()

    // Delete from public index if exists
    await dynamodb.delete({
      TableName: 'Twilly',
      Key: { PK: 'PUBLIC_TALENT_REQUESTS', SK: `REQUEST#${requestId}` }
    }).promise().catch(() => {})

    // Delete all applications under this request
    // Applications are stored with PK = USER#${userEmail} and SK = TALENT_REQUEST#${requestId}#APPLICATION#${applicationId}
    const appsQuery = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: { 
        ':pk': requestItem.PK, // Use the same PK as the request (USER#${userEmail})
        ':sk': `TALENT_REQUEST#${requestId}#APPLICATION#` 
      }
    }
    const apps = await dynamodb.query(appsQuery).promise()
    console.log('Delete API - Found applications to delete:', apps.Items?.length || 0)
    
    const deletes = (apps.Items || []).map(item => dynamodb.delete({
      TableName: 'Twilly',
      Key: { PK: item.PK, SK: item.SK }
    }).promise())
    await Promise.allSettled(deletes)

    return { success: true }
  } catch (error) {
    console.error('Error deleting talent request:', error)
    return { success: false, message: error.message || 'Failed to delete request' }
  }
})


