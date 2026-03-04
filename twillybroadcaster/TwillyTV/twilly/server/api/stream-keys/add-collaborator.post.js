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

    console.log('Adding collaborator to stream key:', {
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

    // Check if collaborator already exists
    const collaborators = existingKey.Item.collaborators || []
    const collaboratorExists = collaborators.some(c => c.email === collaboratorEmail)

    if (collaboratorExists) {
      return {
        success: false,
        message: 'Collaborator already exists for this key'
      }
    }

    // Add new collaborator
    const newCollaborator = {
      email: collaboratorEmail,
      addedAt: new Date().toISOString(),
      status: 'active'
    }

    collaborators.push(newCollaborator)

    // Update the stream key record
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: `STREAM_KEY#${streamKey}`,
        SK: userEmail
      },
      UpdateExpression: 'SET collaborators = :collaborators, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':collaborators': collaborators,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    }

    const result = await dynamodb.update(updateParams).promise()

    console.log('Collaborator added successfully:', {
      streamKey,
      collaboratorEmail,
      totalCollaborators: collaborators.length
    })

    return {
      success: true,
      message: 'Collaborator added successfully',
      data: {
        streamKey,
        collaborator: newCollaborator,
        totalCollaborators: collaborators.length
      }
    }

  } catch (error) {
    console.error('Error adding collaborator to stream key:', error)
    return {
      success: false,
      message: 'Failed to add collaborator',
      error: error.message
    }
  }
}) 