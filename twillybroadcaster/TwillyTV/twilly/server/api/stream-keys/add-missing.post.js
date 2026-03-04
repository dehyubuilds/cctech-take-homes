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
    const { streamKey, userEmail, channelName } = body

    if (!streamKey || !userEmail || !channelName) {
      return {
        success: false,
        message: 'Missing required parameters: streamKey, userEmail, channelName'
      }
    }

    console.log('Adding missing stream key:', {
      streamKey,
      userEmail,
      channelName
    })

    // Check if stream key already exists
    const scanParams = {
      TableName: 'Twilly',
      FilterExpression: 'streamKey = :streamKey',
      ExpressionAttributeValues: {
        ':streamKey': streamKey
      }
    }

    const existingKeys = await dynamodb.scan(scanParams).promise()
    
    if (existingKeys.Items && existingKeys.Items.length > 0) {
      // Check if any of the existing items is a proper stream key record (not a file record)
      const streamKeyRecord = existingKeys.Items.find(item => 
        item.PK && item.PK.startsWith('STREAM_KEY#') && item.streamKey === streamKey
      )
      
      if (streamKeyRecord) {
        console.log('Stream key already exists as stream key record:', streamKeyRecord)
        return {
          success: true,
          message: 'Stream key already exists',
          data: streamKeyRecord
        }
      }
      
      // If we found file records but no stream key record, we need to create the stream key record
      console.log('Found file records but no stream key record, creating stream key record...')
    }

    // Get the next key number for this user/channel
    const queryParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk',
      FilterExpression: 'channelName = :channelName AND ownerEmail = :userEmail',
      ExpressionAttributeValues: {
        ':pk': `STREAM_KEY#${userEmail}`,
        ':channelName': channelName,
        ':userEmail': userEmail
      }
    }

    const existingKeysResult = await dynamodb.query(queryParams).promise()
    let maxKeyNumber = 0
    
    if (existingKeysResult.Items && existingKeysResult.Items.length > 0) {
      maxKeyNumber = Math.max(
        ...existingKeysResult.Items.map(item => parseInt(item.keyNumber || '0'))
      )
    }
    
    const newKeyNumber = maxKeyNumber + 1

    // Create the stream key record
    const streamKeyRecord = {
      PK: `STREAM_KEY#${userEmail}`,
      SK: streamKey,
      streamKey: streamKey,
      ownerEmail: userEmail,
      channelName: channelName,
      creatorId: userEmail,
      channelId: `channel_${channelName.toLowerCase().replace(/\s+/g, '_')}`,
      isActive: true,
      createdAt: new Date().toISOString(),
      keyNumber: newKeyNumber,
      status: 'ACTIVE'
    }

    await dynamodb.put({
      TableName: 'Twilly',
      Item: streamKeyRecord
    }).promise()

    console.log('Successfully added missing stream key:', {
      streamKey,
      userEmail,
      channelName,
      keyNumber: newKeyNumber
    })

    return {
      success: true,
      message: 'Stream key added successfully',
      data: {
        streamKey,
        userEmail,
        channelName,
        keyNumber: newKeyNumber
      }
    }

  } catch (error) {
    console.error('Error adding missing stream key:', error)
    return {
      success: false,
      message: 'Failed to add stream key',
      error: error.message
    }
  }
}) 