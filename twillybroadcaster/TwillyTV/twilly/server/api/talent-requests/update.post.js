import AWS from 'aws-sdk'

export default defineEventHandler(async (event) => {
  // Match existing endpoints: explicit region and credentials (note: insecure for prod)
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  })

  const dynamodb = new AWS.DynamoDB.DocumentClient()

  try {
    const body = await readBody(event)
    const { 
      requestId, 
      projectTitle, 
      channel, 
      status, 
      startDate, 
      streamLength, 
      location, 
      showConcept, 
      castingNeeds, 
      timeSlots, 
      tags, 
      revenueShare, 
      channelPosterUrl,
      inspirationImage, 
      pilotUrl 
    } = body || {}

    if (!requestId) {
      throw new Error('requestId is required')
    }

    console.log('Update API - Updating talent request:', { requestId, projectTitle, channel })
    console.log('Update API - Full request data:', JSON.stringify(body, null, 2))
    console.log('Update API - Project title received:', projectTitle)

    // Build update expression and attribute values
    const updateExpressions = []
    const expressionAttributeValues = {}
    const expressionAttributeNames = {}

    // Helper function to add field to update
    const addField = (fieldName, value, attributeName = null) => {
      if (value !== undefined && value !== null) {
        const attrName = attributeName || `#${fieldName}`
        const attrValue = `:${fieldName}`
        updateExpressions.push(`${attrName} = ${attrValue}`)
        expressionAttributeValues[attrValue] = value
        expressionAttributeNames[attrName] = fieldName
      }
    }

    // Add all fields to update
    addField('projectTitle', projectTitle)
    addField('channel', channel)
    addField('status', status)
    addField('startDate', startDate)
    addField('streamLength', streamLength)
    addField('location', location)
    addField('showConcept', showConcept)
    addField('castingNeeds', castingNeeds)
    addField('timeSlots', timeSlots)
    addField('tags', tags)
    addField('revenueShare', revenueShare)
    addField('channelPosterUrl', channelPosterUrl)
    addField('inspirationImage', inspirationImage)
    addField('pilotUrl', pilotUrl)
    addField('updatedAt', new Date().toISOString())

    if (updateExpressions.length === 0) {
      return { success: false, message: 'No fields to update' }
    }

    // First, we need to find the existing request to get the correct PK
    // Query for the request by ID to get the user email
    const queryParams = {
      TableName: 'Twilly',
      IndexName: 'GSI1', // Use GSI if available, otherwise we'll scan
      KeyConditionExpression: 'SK = :sk',
      ExpressionAttributeValues: {
        ':sk': `TALENT_REQUEST#${requestId}`
      }
    }
    
    let userEmail = null
    
    try {
      const queryResult = await dynamodb.query(queryParams).promise()
      if (queryResult.Items && queryResult.Items.length > 0) {
        userEmail = queryResult.Items[0].creatorEmail
        console.log('Update API - Found user email:', userEmail)
      }
    } catch (error) {
      console.log('Update API - GSI query failed, trying scan approach')
      // Fallback: scan for the request
      const scanParams = {
        TableName: 'Twilly',
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':id': requestId }
      }
      const scanResult = await dynamodb.scan(scanParams).promise()
      if (scanResult.Items && scanResult.Items.length > 0) {
        userEmail = scanResult.Items[0].creatorEmail
        console.log('Update API - Found user email via scan:', userEmail)
      }
    }
    
    if (!userEmail) {
      throw new Error('Could not find user email for request ID: ' + requestId)
    }
    
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userEmail}`,
        SK: `TALENT_REQUEST#${requestId}`
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW'
    }

    console.log('Update expressions:', updateExpressions)
    console.log('Expression attribute values:', expressionAttributeValues)
    console.log('Update params:', JSON.stringify(updateParams, null, 2))

    const result = await dynamodb.update(updateParams).promise()

    console.log('Update API - Talent request updated successfully:', result.Attributes)
    console.log('Update API - Updated project title:', result.Attributes?.projectTitle)

    return { 
      success: true, 
      message: 'Talent request updated successfully',
      request: result.Attributes
    }

  } catch (error) {
    console.error('Error updating talent request:', error)
    return { success: false, message: error.message || 'Failed to update talent request' }
  }
})
