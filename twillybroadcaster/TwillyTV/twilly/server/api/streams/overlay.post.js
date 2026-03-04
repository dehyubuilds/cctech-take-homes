import AWS from 'aws-sdk'

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials for deployment compatibility
  AWS.config.update({
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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',
    region: 'us-east-1'
  })

  const dynamodb = new AWS.DynamoDB.DocumentClient()
  
  try {
    const body = await readBody(event)
    const { streamKey, overlay } = body

    if (!streamKey) {
      throw createError({
        statusCode: 400,
        message: 'Missing required parameter: streamKey'
      })
    }

    if (!overlay) {
      throw createError({
        statusCode: 400,
        message: 'Missing required parameter: overlay'
      })
    }

    console.log('Storing overlay metadata for streamKey:', streamKey)
    console.log('Overlay config:', JSON.stringify(overlay, null, 2))

    // Set TTL to 24 hours from now (86400 seconds)
    const ttl = Math.floor(Date.now() / 1000) + 86400

    const params = {
      TableName: 'Twilly',
      Item: {
        PK: `STREAM_OVERLAY#${streamKey}`,
        SK: 'metadata',
        streamKey: streamKey,
        overlay: overlay,
        createdAt: new Date().toISOString(),
        ttl: ttl, // Auto-delete after 24 hours
        type: 'stream_overlay'
      }
    }

    await dynamodb.put(params).promise()
    console.log('✅ Overlay metadata stored successfully for streamKey:', streamKey)

    return {
      success: true,
      message: 'Overlay metadata stored successfully',
      streamKey: streamKey
    }
  } catch (error) {
    console.error('Error storing overlay metadata:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to store overlay metadata',
      details: error.message
    })
  }
})

