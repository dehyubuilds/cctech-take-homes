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
    const { userEmail } = body

    if (!userEmail) {
      throw new Error('User email is required')
    }

    // Query for talent requests created by this user
    const queryParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userEmail}`,
        ':skPrefix': 'TALENT_REQUEST#'
      }
    }

    console.log('Querying for talent requests with params:', queryParams)
    
    const result = await dynamodb.query(queryParams).promise()
    
    console.log('Query result:', result)

    // Filter out application records (they have APPLICATION# in their SK)
    const talentRequests = (result.Items || []).filter(item => !item.SK.includes('APPLICATION#'))

    // Sort by creation date (newest first)
    talentRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return {
      success: true,
      talentRequests,
      total: talentRequests.length
    }

  } catch (error) {
    console.error('Error getting user talent requests:', error)
    return {
      success: false,
      message: error.message || 'Failed to get talent requests'
    }
  }
})
