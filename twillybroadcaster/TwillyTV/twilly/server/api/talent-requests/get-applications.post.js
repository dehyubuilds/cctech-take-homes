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
    const { requestId } = body || {}

    if (!requestId) {
      throw new Error('requestId is required')
    }

    const queryParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `TALENT_REQUEST#${requestId}`,
        ':sk': 'APPLICATION#'
      }
    }

    const result = await dynamodb.query(queryParams).promise()
    const applications = result.Items || []
    return { success: true, applications }
  } catch (error) {
    console.error('Error getting applications:', error)
    return { success: false, message: error.message || 'Failed to get applications' }
  }
})


