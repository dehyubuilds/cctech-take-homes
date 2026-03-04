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
    const { streamKey, collaboratorEmail, userEmail } = body

    if (!streamKey || !collaboratorEmail || !userEmail) {
      return {
        success: false,
        message: 'Missing required parameters: streamKey, collaboratorEmail, userEmail'
      }
    }

    console.log('Removing collaborator from stream key:', {
      streamKey,
      collaboratorEmail,
      userEmail
    })

    // First, get the existing stream key record
    const getParams = {
      TableName: 'Twilly',
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: userEmail
      }
    }

    const existingKey = await dynamodb.get(getParams).promise()

    if (!existingKey.Item) {
      return {
        success: false,
        message: 'Stream key not found'
      }
    }

    // Remove the collaborator
    const collaborators = existingKey.Item.collaborators || []
    const filteredCollaborators = collaborators.filter(c => c.email !== collaboratorEmail)

    if (filteredCollaborators.length === collaborators.length) {
      return {
        success: false,
        message: 'Collaborator not found for this key'
      }
    }

    // Update the stream key record
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: userEmail
      },
      UpdateExpression: 'SET collaborators = :collaborators, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':collaborators': filteredCollaborators,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    }

    const result = await dynamodb.update(updateParams).promise()

    console.log('Collaborator removed successfully:', {
      streamKey,
      collaboratorEmail,
      remainingCollaborators: filteredCollaborators.length
    })

    return {
      success: true,
      message: 'Collaborator removed successfully',
      data: {
        streamKey,
        removedCollaborator: collaboratorEmail,
        remainingCollaborators: filteredCollaborators.length
      }
    }

  } catch (error) {
    console.error('Error removing collaborator from stream key:', error)
    return {
      success: false,
      message: 'Failed to remove collaborator',
      error: error.message
    }
  }
}) 