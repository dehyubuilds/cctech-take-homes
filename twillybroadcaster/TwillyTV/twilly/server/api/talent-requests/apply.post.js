import AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'

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
    
    if (!body) {
      throw new Error('No request body received')
    }

    // Extract application fields
    const { 
      talentRequestId,
      fullName,
      contactInfo,
      interest,
      experience = ''
    } = body

    // Validate required fields
    if (!talentRequestId || !fullName || !contactInfo || !interest) {
      throw new Error('Missing required fields')
    }

    // First, get the talent request to validate it exists and is accepting applications
    const talentRequestQuery = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'id = :requestId',
      ExpressionAttributeValues: {
        ':pk': 'USER#*', // We'll need to find the actual user
        ':skPrefix': 'TALENT_REQUEST#',
        ':requestId': talentRequestId
      }
    }

    // Since we don't have the exact PK, we'll need to scan or use a different approach
    // For now, let's assume we can find it by scanning for the request ID
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'id = :requestId',
      ExpressionAttributeValues: {
        ':requestId': talentRequestId
      }
    }

    const talentRequestResult = await dynamodb.scan(scanParams).promise()
    
    if (!talentRequestResult.Items || talentRequestResult.Items.length === 0) {
      throw new Error('Talent request not found')
    }

    const talentRequest = talentRequestResult.Items[0]

    // Check if the request is still accepting applications
    if (talentRequest.status === 'casting_closed') {
      throw new Error('Casting is closed for this request')
    }

    // Generate application ID
    const applicationId = uuidv4()
    const timestamp = new Date().toISOString()

    // Create the application item
    const applicationItem = {
      PK: `TALENT_REQUEST#${talentRequestId}`,
      SK: `APPLICATION#${applicationId}`,
      applicationId,
      talentRequestId,
      fullName,
      contactInfo,
      interest,
      experience,
      status: 'pending', // pending, approved, rejected
      createdAt: timestamp,
      updatedAt: timestamp
    }

    // Store application in DynamoDB
    await dynamodb.put({
      TableName: 'Twilly',
      Item: applicationItem
    }).promise()

    // Update the talent request to include the new application
    const updatedApplications = talentRequest.applications || []
    updatedApplications.push({
      applicationId,
      fullName,
      contactInfo,
      status: 'pending',
      createdAt: timestamp
    })

    // Update the talent request
    await dynamodb.update({
      TableName: 'Twilly',
      Key: {
        PK: talentRequest.PK,
        SK: talentRequest.SK
      },
      UpdateExpression: 'SET applications = :applications, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':applications': updatedApplications,
        ':updatedAt': timestamp
      }
    }).promise()

    return {
      success: true,
      message: 'Application submitted successfully',
      applicationId
    }

  } catch (error) {
    console.error('Error submitting application:', error)
    return {
      success: false,
      message: error.message || 'Failed to submit application'
    }
  }
})
