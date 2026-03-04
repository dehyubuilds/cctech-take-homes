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
    const { slug } = body

    if (!slug) {
      throw new Error('Slug is required')
    }

    // Parse slug to get username and channel (format: username/channel)
    const slugParts = slug.split('/')
    if (slugParts.length !== 2) {
      throw new Error('Invalid slug format')
    }
    
    const [username, channel] = slugParts
    
    // Scan for talent request by username and channel
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'creatorUsername = :username AND channel = :channel',
      ExpressionAttributeValues: {
        ':username': username,
        ':channel': channel
      }
    }

    console.log('Scanning for talent request with username:', username, 'and channel:', channel)
    
    const result = await dynamodb.scan(scanParams).promise()
    
    console.log('Query result:', result)

    if (result.Items && result.Items.length > 0) {
      const talentRequest = result.Items[0]
      
      // Check if request is public or if user has access
      if (talentRequest.isPublic || talentRequest.status !== 'casting_closed') {
        return {
          success: true,
          talentRequest
        }
      } else {
        return {
          success: false,
          message: 'Talent request is private or casting is closed'
        }
      }
    } else {
      return {
        success: false,
        message: 'Talent request not found'
      }
    }

  } catch (error) {
    console.error('Error getting talent request:', error)
    return {
      success: false,
      message: error.message || 'Failed to get talent request'
    }
  }
})
