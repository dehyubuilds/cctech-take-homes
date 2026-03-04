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
    const { streamKey } = body

    if (!streamKey) {
      throw createError({
        statusCode: 400,
        message: 'Missing required parameter: streamKey'
      })
    }

    console.log('Clearing overlay metadata for streamKey:', streamKey)

    const params = {
      TableName: 'Twilly',
      Key: {
        PK: `STREAM_OVERLAY#${streamKey}`,
        SK: 'metadata'
      }
    }

    await dynamodb.delete(params).promise()
    console.log('✅ Overlay metadata cleared successfully for streamKey:', streamKey)

    return {
      success: true,
      message: 'Overlay metadata cleared successfully',
      streamKey: streamKey
    }
  } catch (error) {
    console.error('Error clearing overlay metadata:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to clear overlay metadata',
      details: error.message
    })
  }
})

