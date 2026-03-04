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

    // Extract form fields
    const { 
      projectTitle,
      channel,
      streamType,
      showConcept,
      castingNeeds,
      streamLength,
      location,
      startDate,
      shootWindow = '',
      timeSlots = [],
      revenueShare = '',
      inspirationLink = '',
      inspirationImage = '',
      pilotUrl = '',
      channelPosterUrl = '',
      tags = [],
      isPublic = true,
      creatorEmail,
      creatorUsername
    } = body

    // Validate required fields
    if (!projectTitle || !channel || !streamType || !showConcept || !castingNeeds || 
        !streamLength || !location || !startDate || !timeSlots || timeSlots.length === 0) {
      throw new Error('Missing required fields')
    }

    if (!creatorEmail || !creatorUsername) {
      throw new Error('Creator information is required')
    }

    // Normalize creatorUsername to NEVER contain email
    const safeCreatorUsername = (creatorUsername || '')?.includes('@')
      ? (creatorUsername || '').split('@')[0]
      : (creatorUsername || '')

    // Generate unique ID and slug
    const requestId = uuidv4()
    const timestamp = new Date().toISOString()
    
    // Create slug using the same pattern as collaborator requests: username/channel
    const slug = `${safeCreatorUsername}/${channel}`
    
    // Also store the old format slug for backward compatibility
    const oldSlug = projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      + '-' + requestId.substring(0, 8)

    // Create the talent request item
    const requestItem = {
      PK: `USER#${creatorEmail}`,
      SK: `TALENT_REQUEST#${requestId}`,
      id: requestId,
      slug,
      oldSlug, // Store both formats for compatibility
      projectTitle,
      channel,
      streamType,
      showConcept,
      castingNeeds,
      streamLength,
      location,
      startDate,
      shootWindow,
      timeSlots,
      revenueShare,
      inspirationLink,
      inspirationImage,
      pilotUrl,
      tags,
      channelPosterUrl,
      isPublic,
      creatorEmail,
      creatorUsername: safeCreatorUsername,
      status: 'accepting_pilots', // accepting_pilots, casting_closed, scheduled
      applications: [],
      createdAt: timestamp,
      updatedAt: timestamp
    }

    // Store in DynamoDB
    await dynamodb.put({
      TableName: 'Twilly',
      Item: requestItem
    }).promise()

    // If public, also store in a public index for discovery
    if (isPublic) {
      const publicItem = {
        PK: 'PUBLIC_TALENT_REQUESTS',
        SK: `REQUEST#${requestId}`,
        id: requestId,
        slug,
        projectTitle,
        channel,
        streamType,
        castingNeeds,
        streamLength,
        location,
        startDate,
        tags,
        creatorUsername: safeCreatorUsername,
        channelPosterUrl,
        inspirationImage,
        status: 'accepting_pilots',
        createdAt: timestamp
      }

      await dynamodb.put({
        TableName: 'Twilly',
        Item: publicItem
      }).promise()
    }

    return {
      success: true,
      message: 'Talent request created successfully',
      requestId,
      slug
    }

  } catch (error) {
    console.error('Error creating talent request:', error)
    return {
      success: false,
      message: error.message || 'Failed to create talent request'
    }
  }
})
