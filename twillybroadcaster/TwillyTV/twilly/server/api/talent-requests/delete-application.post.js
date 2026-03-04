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
    console.log('Delete Application API - Received body:', body)
    const { requestId, applicationId } = body || {}

    if (!requestId || !applicationId) {
      console.log('Delete Application API - Missing requestId or applicationId:', { requestId, applicationId })
      throw new Error('requestId and applicationId are required')
    }
    
    console.log('Delete Application API - Deleting application with requestId:', requestId, 'applicationId:', applicationId)

    // Find the application to get the PK (user email)
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'requestId = :requestId AND applicationId = :applicationId',
      ExpressionAttributeValues: { 
        ':requestId': requestId,
        ':applicationId': applicationId
      }
    }
    const scanResult = await dynamodb.scan(scanParams).promise()
    console.log('Delete Application API - Scan result:', scanResult.Items?.length || 0, 'items found')
    
    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log('Delete Application API - No application found for requestId:', requestId, 'applicationId:', applicationId)
      throw new Error('Application not found')
    }
    
    const applicationItem = scanResult.Items[0]
    console.log('Delete Application API - Found application:', applicationItem.fullName)

    // Delete the application
    await dynamodb.delete({
      TableName: 'Twilly',
      Key: { PK: applicationItem.PK, SK: applicationItem.SK }
    }).promise()

    console.log('Delete Application API - Application deleted successfully')

    return { success: true }
  } catch (error) {
    console.error('Error deleting application:', error)
    return { success: false, message: error.message || 'Failed to delete application' }
  }
})
