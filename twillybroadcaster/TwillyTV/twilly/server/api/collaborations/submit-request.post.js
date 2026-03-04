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
  const s3 = new AWS.S3()

  try {
    const body = await readBody(event)
    
    if (!body) {
      throw new Error('No request body received')
    }

    // Extract form fields
    const { 
      channelId, 
      creatorUsername, 
      fullName, 
      contactInfo, 
      streamConcept, 
      preferredTimeSlots, 
      contentLink = '', 
      availability, 
      clipUrl = '' 
    } = body

    // Validate required fields
    if (!channelId || !creatorUsername || !fullName || !contactInfo || !streamConcept || !availability) {
      throw new Error('Missing required fields')
    }

    // Generate unique ID for the request
    const requestId = uuidv4()
    const timestamp = new Date().toISOString()

    // Use the provided clipUrl (already uploaded via separate endpoint)
    console.log('Using provided clip URL:', clipUrl)

    // Get creator email from username
    let creatorEmail = ''
    try {
      // Query for user by username using PK = 'USER' and scanning for username
      const userQuery = {
        TableName: 'Twilly',
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'username = :username',
        ExpressionAttributeValues: {
          ':pk': 'USER',
          ':username': creatorUsername
        }
      }
      
      const userResult = await dynamodb.query(userQuery).promise()
      if (userResult.Items && userResult.Items.length > 0) {
        creatorEmail = userResult.Items[0].email || ''
        console.log('Found creator email:', creatorEmail)
      } else {
        console.log('No user found for username:', creatorUsername)
      }
    } catch (error) {
      console.error('Error finding creator email:', error)
    }

    // Ensure we have a valid email for the PK
    if (!creatorEmail) {
      throw new Error('Could not find creator email for username: ' + creatorUsername)
    }

    // Create the collaborator request item
    const requestItem = {
      PK: `USER#${creatorEmail}`,
      SK: `COLLAB_REQUEST#${requestId}`,
      requestId,
      channelId,
      creatorUsername,
      creatorEmail,
      fullName,
      contactInfo,
      streamConcept,
      preferredTimeSlots,
      contentLink,
      availability,
      clipUrl,
      status: 'pending', // pending, approved, rejected
      createdAt: timestamp,
      updatedAt: timestamp
    }

    // Store in DynamoDB
    await dynamodb.put({
      TableName: 'Twilly',
      Item: requestItem
    }).promise()

    return {
      success: true,
      message: 'Collaborator request submitted successfully',
      requestId
    }

  } catch (error) {
    console.error('Error submitting collaborator request:', error)
    return {
      success: false,
      message: error.message || 'Failed to submit collaborator request'
    }
  }
}) 