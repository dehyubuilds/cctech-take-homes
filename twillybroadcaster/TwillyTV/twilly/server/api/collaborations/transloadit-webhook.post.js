import AWS from 'aws-sdk'

const dynamodb = new AWS.DynamoDB.DocumentClient()

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    
    console.log('Transloadit webhook received:', JSON.stringify(body, null, 2))

    // Verify the webhook is from Transloadit (you should add proper verification)
    const { assembly_id, fields, results } = body

    if (!assembly_id || !fields || !results) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid webhook payload'
      })
    }

    const { creatorUsername, requestId, filename } = fields

    // Find the uploaded file in results
    let uploadedFile = null
    if (results.s3 && results.s3.length > 0) {
      uploadedFile = results.s3[0]
    }

    if (!uploadedFile) {
      console.error('No S3 upload found in results')
      return { success: false, message: 'No upload found' }
    }

    // Update the collaborator request with the uploaded file URL
    const cloudFrontUrl = `https://d3hv50jkrzkiyh.cloudfront.net/${uploadedFile.path}`
    
    // Store the upload result in DynamoDB
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: `USER#${creatorUsername}`,
        SK: `COLLAB_REQUEST#${requestId}`
      },
      UpdateExpression: 'SET clipUrl = :clipUrl, uploadCompleted = :uploadCompleted, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':clipUrl': cloudFrontUrl,
        ':uploadCompleted': true,
        ':updatedAt': new Date().toISOString()
      }
    }

    await dynamodb.update(updateParams).promise()

    console.log('Upload completed successfully:', {
      requestId,
      creatorUsername,
      cloudFrontUrl
    })

    return {
      success: true,
      message: 'Upload processed successfully',
      clipUrl: cloudFrontUrl
    }

  } catch (error) {
    console.error('Transloadit webhook error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process webhook'
    })
  }
}) 