import AWS from 'aws-sdk'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  
  // Configure AWS
  AWS.config.update({
    accessKeyId: config.awsAccessKeyId,
    secretAccessKey: config.awsSecretAccessKey,
    region: config.awsRegion || 'us-east-1'
  })

  const dynamodb = new AWS.DynamoDB.DocumentClient()
  
  try {
    const body = await readBody(event)
    const { channelId, guestEmail, guestUserId } = body

    if (!channelId || !guestEmail || !guestUserId) {
      return {
        success: false,
        message: 'Missing required fields: channelId, guestEmail, guestUserId'
      }
    }

    console.log('Accepting invite:', {
      channelId,
      guestEmail,
      guestUserId
    })

    // Create a unique guest stream key using user ID instead of email
    const guestStreamKey = `sk_${guestUserId.replace(/[^a-zA-Z0-9]/g, '')}_on_${channelId}`

    // Store the guest stream key mapping with user ID
    await dynamodb.put({
      TableName: 'Twilly',
      Item: {
        PK: `STREAM_KEY#${guestStreamKey}`,
        SK: guestEmail,
        streamKey: guestStreamKey,
        guestUserId: guestUserId,
        guestEmail: guestEmail,
        channelId: channelId,
        isActive: true,
        isGuestKey: true,
        createdAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
        keyNumber: 1, // Guest keys are always #1
        channelName: channelId, // Use channelId as channelName for guest keys
        ownerEmail: guestEmail,
        collaborators: [], // Guest keys don't have collaborators initially
        usageStats: {
          totalStreams: 0,
          lastUsed: null
        }
      }
    }).promise()

    // Also store a reverse mapping for easy lookup
    await dynamodb.put({
      TableName: 'Twilly',
      Item: {
        PK: `GUEST_MAPPING#${guestUserId}`,
        SK: channelId,
        guestStreamKey: guestStreamKey,
        guestEmail: guestEmail,
        channelId: channelId,
        acceptedAt: new Date().toISOString()
      }
    }).promise()

    console.log('Guest stream key created successfully:', {
      guestStreamKey,
      guestUserId,
      guestEmail,
      channelId
    })

    return {
      success: true,
      guestStreamKey,
      message: 'Invite accepted and stream key activated'
    }

  } catch (error) {
    console.error('Error accepting invite:', error)
    return {
      success: false,
      message: 'Failed to accept invite',
      error: error.message
    }
  }
}) 