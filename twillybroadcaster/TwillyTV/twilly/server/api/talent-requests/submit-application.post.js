import AWS from 'aws-sdk'

export default defineEventHandler(async (event) => {
  // Match existing endpoints: explicit region and credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  })

  const dynamodb = new AWS.DynamoDB.DocumentClient()

  try {
    const body = await readBody(event)
    const { requestId, fullName, contactInfo, interest, experience } = body

    if (!requestId || !fullName || !contactInfo) {
      return {
        success: false,
        message: 'Missing required fields: requestId, fullName, and contactInfo are required'
      }
    }

    // Generate a unique application ID
    const applicationId = `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // First, get the talent request to find the creator's email
    // Use the same pattern as get-by-id.post.js - scan for the request
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'id = :id',
      ExpressionAttributeValues: { ':id': requestId }
    }

    console.log('Submit Application API - Looking for request ID:', requestId)
    const requestResult = await dynamodb.scan(scanParams).promise()
    
    console.log('Submit Application API - Scan result:', requestResult.Items?.length || 0, 'items found')
    
    if (!requestResult.Items || requestResult.Items.length === 0) {
      console.log('Submit Application API - No talent request found for ID:', requestId)
      return {
        success: false,
        message: 'Talent request not found'
      }
    }

    const talentRequest = requestResult.Items[0]
    const creatorEmail = talentRequest.creatorEmail
    console.log('Submit Application API - Found talent request:', talentRequest.projectTitle)
    console.log('Submit Application API - Creator email:', creatorEmail)

    // Create the application record
    const applicationData = {
      applicationId,
      requestId,
      fullName,
      contactInfo,
      interest: interest || '',
      experience: experience || '',
      status: 'pending',
      submittedAt: new Date().toISOString()
    }

    // Store the application in DynamoDB
    const putParams = {
      TableName: 'Twilly',
      Item: {
        PK: `USER#${creatorEmail}`,
        SK: `TALENT_REQUEST#${requestId}#APPLICATION#${applicationId}`,
        ...applicationData
      }
    }

    await dynamodb.put(putParams).promise()

    // Update the talent request to include the new application
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: `USER#${creatorEmail}`,
        SK: `TALENT_REQUEST#${requestId}`
      },
      UpdateExpression: 'SET applications = list_append(if_not_exists(applications, :empty_list), :new_application)',
      ExpressionAttributeValues: {
        ':empty_list': [],
        ':new_application': [applicationData]
      }
    }

    await dynamodb.update(updateParams).promise()

    console.log('Application submitted successfully:', {
      applicationId,
      requestId,
      fullName,
      contactInfo
    })

    return {
      success: true,
      applicationId,
      message: 'Application submitted successfully'
    }

  } catch (error) {
    console.error('Error submitting application:', error)
    return {
      success: false,
      message: 'Failed to submit application: ' + error.message
    }
  }
})
