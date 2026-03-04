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
    const { streamKey, isActive, userEmail } = body

    if (!streamKey || isActive === undefined || !userEmail) {
      return {
        success: false,
        message: 'Missing required parameters: streamKey, isActive, userEmail'
      }
    }

    console.log('Toggling stream key status:', {
      streamKey,
      isActive,
      userEmail
    })

    // First find the stream key record - check both new and old structures
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'streamKey = :streamKey OR begins_with(PK, :pkPrefix)',
      ExpressionAttributeValues: {
        ':streamKey': streamKey,
        ':pkPrefix': `STREAM_KEY#${streamKey}`
      }
    }

    const existingKeys = await dynamodb.scan(scanParams).promise()

    if (!existingKeys.Items || existingKeys.Items.length === 0) {
      return {
        success: false,
        message: 'Stream key not found'
      }
    }

    // Filter out file records and find the actual stream key record
    const streamKeyRecord = existingKeys.Items.find(item => 
      item.PK && item.PK.startsWith('STREAM_KEY#') && 
      (item.streamKey === streamKey || item.SK === streamKey)
    );
    
    if (!streamKeyRecord) {
      return {
        success: false,
        message: 'Stream key record not found'
      }
    }

    // Update the stream key status
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: streamKeyRecord.PK,
        SK: streamKeyRecord.SK
      },
      UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isActive': isActive,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    }

    const result = await dynamodb.update(updateParams).promise()

    console.log('Stream key status updated successfully:', {
      streamKey,
      isActive,
      updatedAt: result.Attributes.updatedAt
    })

    return {
      success: true,
      message: `Stream key ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        streamKey,
        isActive,
        updatedAt: result.Attributes.updatedAt
      }
    }

  } catch (error) {
    console.error('Error toggling stream key status:', error)
    return {
      success: false,
      message: 'Failed to update stream key status',
      error: error.message
    }
  }
}) 