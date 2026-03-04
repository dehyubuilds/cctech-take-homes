import AWS from 'aws-sdk'

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
    const { channelId, creatorUsername } = body

    if (!channelId || !creatorUsername) {
      return {
        success: false,
        message: 'Missing required parameters'
      }
    }

    console.log('Validating collaborator request:', { channelId, creatorUsername })

    // Decode URL-encoded channel name
    const decodedChannelId = decodeURIComponent(channelId)
    console.log('Decoded channel ID:', decodedChannelId)

    // Convert username to email if needed
    let creatorEmail = creatorUsername
    if (!creatorUsername.includes('@')) {
      // For usernames, we need to look up the actual email
      try {
        console.log('Looking up email for username:', creatorUsername)
        
        // Query the Twilly table for user by username
        const userParams = {
          TableName: 'Twilly',
          FilterExpression: 'PK = :pk AND username = :username',
          ExpressionAttributeValues: {
            ':pk': 'USER',
            ':username': creatorUsername
          }
        };

        const userResult = await dynamodb.scan(userParams).promise();
        console.log('User lookup result:', userResult);

        if (!userResult.Items || userResult.Items.length === 0) {
          return {
            success: false,
            message: 'Creator not found'
          }
        }

        const user = userResult.Items[0];
        creatorEmail = user.email;
        console.log('Found email for username:', creatorUsername, '→', creatorEmail);
      } catch (error) {
        console.error('Error looking up user by username:', error);
        return {
          success: false,
          message: 'Failed to find creator'
        }
      }
    }

    // Try multiple approaches to find the channel
    let channel = null

    // Approach 1: Look for channel with exact PK/SK structure
    try {
      const channelResponse = await dynamodb.query({
        TableName: 'Twilly',
        KeyConditionExpression: 'PK = :pk AND SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `CHANNEL#${decodedChannelId}`,
          ':sk': `CHANNEL#${decodedChannelId}`
        }
      }).promise()

      if (channelResponse.Items && channelResponse.Items.length > 0) {
        channel = channelResponse.Items[0]
        console.log('Found channel with PK/SK structure:', channel)
      }
    } catch (error) {
      console.log('No channel found with PK/SK structure:', error.message)
    }

    // Approach 2: Look for channel in user's channel list
    if (!channel) {
      try {
        // Get user's channels using email as schedulerId
        const userResponse = await dynamodb.get({
          TableName: 'Twilly',
          Key: {
            schedulerId: creatorEmail,
            id: 'None'
          }
        }).promise()

        if (userResponse.Item && userResponse.Item.Channels) {
          const channels = userResponse.Item.Channels
          if (channels[decodedChannelId]) {
            channel = {
              channelId: decodedChannelId,
              channelName: decodedChannelId,
              creatorUsername: creatorEmail
            }
            console.log('Found channel in user channels:', channel)
          }
        }
      } catch (error) {
        console.log('No channel found in user channels:', error.message)
      }
    }

    // Approach 3: Look for stream keys that match this channel
    if (!channel) {
      try {
        const streamKeyResponse = await dynamodb.scan({
          TableName: 'Twilly',
          FilterExpression: 'channelName = :channelName AND ownerEmail = :creatorEmail',
          ExpressionAttributeValues: {
            ':channelName': decodedChannelId,
            ':creatorEmail': creatorEmail
          }
        }).promise()

        if (streamKeyResponse.Items && streamKeyResponse.Items.length > 0) {
          channel = {
            channelId: decodedChannelId,
            channelName: decodedChannelId,
            creatorUsername: creatorEmail
          }
          console.log('Found channel via stream keys:', channel)
        }
      } catch (error) {
        console.log('No channel found via stream keys:', error.message)
      }
    }

    // Approach 4: Look for channel in folder structure
    if (!channel) {
      try {
        const folderResponse = await dynamodb.query({
          TableName: 'Twilly',
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `USER#${creatorEmail}`,
            ':sk': 'FOLDER#'
          }
        }).promise()

        if (folderResponse.Items && folderResponse.Items.length > 0) {
          // Look for a folder that matches the channel name
          const matchingFolder = folderResponse.Items.find(folder => 
            folder.name === decodedChannelId || folder.SK?.includes(decodedChannelId)
          )
          
          if (matchingFolder) {
            channel = {
              channelId: decodedChannelId,
              channelName: decodedChannelId,
              creatorUsername: creatorEmail
            }
            console.log('Found channel via folder structure:', channel)
          }
        }
      } catch (error) {
        console.log('No channel found via folder structure:', error.message)
      }
    }

    if (!channel) {
      console.log('Channel not found after all attempts')
      return {
        success: false,
        message: 'Channel not found'
      }
    }

    // Check if the creator email matches
    if (channel.creatorUsername && channel.creatorUsername !== creatorEmail) {
      console.log('Creator email mismatch:', channel.creatorUsername, 'vs', creatorEmail)
      return {
        success: false,
        message: 'Invalid channel information'
      }
    }

    console.log('Validation successful for channel:', channel)

    return {
      success: true,
      message: 'Valid collaboration request',
      channel: {
        channelId: channel.channelId || decodedChannelId,
        channelName: channel.channelName || decodedChannelId,
        creatorUsername: channel.creatorUsername || creatorEmail
      }
    }

  } catch (error) {
    console.error('Error validating collaborator request:', error)
    return {
      success: false,
      message: error.message || 'Failed to validate request'
    }
  }
}) 