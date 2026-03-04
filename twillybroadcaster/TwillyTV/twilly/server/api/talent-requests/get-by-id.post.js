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
    console.log('Get by ID API - Received body:', body)
    
    const { requestId, id } = body || {}
    
    // Accept both requestId and id for compatibility
    const requestIdToUse = requestId || id
    console.log('Get by ID API - Using requestId:', requestIdToUse)

    if (!requestIdToUse) {
      throw new Error('requestId or id is required')
    }

    // First try to find by scanning for the ID (most reliable)
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'id = :id',
      ExpressionAttributeValues: { ':id': requestIdToUse }
    }

    const result = await dynamodb.scan(scanParams).promise()
    console.log('Get by ID API - Scan result:', result.Items?.length || 0, 'items found')
    
    if (result.Items && result.Items.length > 0) {
      console.log('Get by ID API - Found request:', result.Items[0].projectTitle)
      console.log('Get by ID API - Full request data:', JSON.stringify(result.Items[0], null, 2))
      return { success: true, request: result.Items[0] }
    }
    
    // If scan didn't work, try the public index as fallback
    console.log('Get by ID API - Trying public index fallback')

    // Fallback: look up in public index by composite key
    const publicKey = { PK: 'PUBLIC_TALENT_REQUESTS', SK: `REQUEST#${requestIdToUse}` }
    try {
      const publicItem = await dynamodb.get({ TableName: 'Twilly', Key: publicKey }).promise()
      if (publicItem && publicItem.Item) {
        return { success: true, request: publicItem.Item }
      }
    } catch (e) {
      // ignore
    }

    return { success: false, message: 'Talent request not found' }
  } catch (error) {
    console.error('Error getting talent request by id:', error)
    return { success: false, message: error.message || 'Failed to get talent request' }
  }
})


