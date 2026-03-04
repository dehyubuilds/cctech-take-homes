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
    const { channelName, userEmail } = body

    if (!channelName || !userEmail) {
      return {
        success: false,
        message: 'Missing required parameters: channelName, userEmail'
      }
    }

    console.log('Getting stream keys for channel:', {
      channelName,
      userEmail
    })

    // Query for all stream keys for this user and channel (new structure)
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

    const result = await dynamodb.query(queryParams).promise()

    // Also check for old structure keys (backward compatibility)
    const oldStructureScanParams = {
      TableName: 'Twilly',
      FilterExpression: 'begins_with(PK, :pkPrefix) AND ownerEmail = :userEmail AND seriesName = :channelName',
      ExpressionAttributeValues: {
        ':pkPrefix': 'STREAM_KEY#',
        ':userEmail': userEmail,
        ':channelName': channelName
      }
    }

    const oldStructureResult = await dynamodb.scan(oldStructureScanParams).promise()

    // Also get guest keys for this user
    const guestKeysQuery = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `GUEST_MAPPING#${userEmail.replace(/[^a-zA-Z0-9]/g, '')}`
      }
    }

    const guestKeysResult = await dynamodb.query(guestKeysQuery).promise()

    // Combine regular keys and guest keys
    let allKeys = []

    // Add personal keys (new structure) - only show personal keys for channel owner
    if (result.Items && result.Items.length > 0) {
      const personalKeys = result.Items
        .filter(item => item.isPersonalKey && !item.isCollaboratorKey) // Only personal keys
        .map(item => ({
          streamKey: item.streamKey,
          keyNumber: parseInt(item.keyNumber || '0'),
          createdAt: item.createdAt || '',
          isActive: item.isActive !== false, // Default to true if not set
          channelName: item.channelName,
          collaborators: item.collaborators || [],
          usageStats: item.usageStats || {
            totalStreams: 0,
            lastUsed: null
          },
          isGuestKey: false,
          isPersonalKey: true
        })).sort((a, b) => a.keyNumber - b.keyNumber)

      allKeys.push(...personalKeys)
    }

    // Add personal keys (old structure - backward compatibility)
    if (oldStructureResult.Items && oldStructureResult.Items.length > 0) {
      const oldStructureKeys = oldStructureResult.Items
        .filter(item => item.isPersonalKey && !item.isCollaboratorKey) // Only personal keys
        .map(item => {
          // Extract stream key from PK for old structure (PK format: STREAM_KEY#sk_xxxxx)
          const streamKeyFromPK = item.PK ? item.PK.replace('STREAM_KEY#', '') : null;
          
          return {
            streamKey: item.streamKey || streamKeyFromPK || item.SK, // Use PK extraction as fallback
            keyNumber: parseInt(item.keyNumber || '0'),
            createdAt: item.createdAt || '',
            isActive: item.status === 'ACTIVE', // Convert old status to isActive
            channelName: item.seriesName, // Convert old seriesName to channelName
            collaborators: item.collaborators || [],
            usageStats: item.usageStats || {
              totalStreams: 0,
              lastUsed: null
            },
            isGuestKey: false,
            isPersonalKey: true // Old structure keys are personal keys
          };
        }).sort((a, b) => a.keyNumber - b.keyNumber)

      allKeys.push(...oldStructureKeys)
    }

    // Add collaborator keys (old structure - backward compatibility)
    if (oldStructureResult.Items && oldStructureResult.Items.length > 0) {
      const collaboratorKeys = oldStructureResult.Items
        .filter(item => item.isCollaboratorKey) // Only collaborator keys
        .map(item => {
          // Extract stream key from PK for old structure (PK format: STREAM_KEY#sk_xxxxx)
          const streamKeyFromPK = item.PK ? item.PK.replace('STREAM_KEY#', '') : null;
          
          return {
            streamKey: item.streamKey || streamKeyFromPK || item.SK, // Use PK extraction as fallback
            keyNumber: parseInt(item.keyNumber || '0'),
            createdAt: item.createdAt || '',
            isActive: item.status === 'ACTIVE', // Convert old status to isActive
            channelName: item.seriesName, // Convert old seriesName to channelName
            collaborators: item.collaborators || [],
            usageStats: item.usageStats || {
              totalStreams: 0,
              lastUsed: null
            },
            isGuestKey: false,
            isPersonalKey: false,
            isCollaboratorKey: true
          };
        }).sort((a, b) => a.keyNumber - b.keyNumber)

      allKeys.push(...collaboratorKeys)
    }

    // Add guest keys
    if (guestKeysResult.Items && guestKeysResult.Items.length > 0) {
      for (const guestMapping of guestKeysResult.Items) {
        // Get the actual guest stream key details
        const guestKeyQuery = {
          TableName: 'Twilly',
          Key: {
            PK: `STREAM_KEY#${guestMapping.guestStreamKey}`,
            SK: userEmail
          }
        }

        const guestKeyResult = await dynamodb.get(guestKeyQuery).promise()
        
        if (guestKeyResult.Item) {
          allKeys.push({
            streamKey: guestKeyResult.Item.streamKey,
            keyNumber: parseInt(guestKeyResult.Item.keyNumber || '0'),
            createdAt: guestKeyResult.Item.createdAt || '',
            isActive: guestKeyResult.Item.isActive !== false,
            channelName: guestKeyResult.Item.channelName,
            collaborators: guestKeyResult.Item.collaborators || [],
            usageStats: guestKeyResult.Item.usageStats || {
              totalStreams: 0,
              lastUsed: null
            },
            isGuestKey: true,
            guestChannelId: guestKeyResult.Item.channelId
          })
        }
      }
    }

    console.log('Found stream keys:', {
      channelName,
      totalKeys: allKeys.length,
      regularKeys: allKeys.filter(k => !k.isGuestKey).length,
      guestKeys: allKeys.filter(k => k.isGuestKey).length
    })

    return {
      success: true,
      streamKeys: allKeys,
      totalKeys: allKeys.length,
      message: `Found ${allKeys.length} stream key(s) for ${channelName}`
    }

  } catch (error) {
    console.error('Error getting stream keys:', error)
    return {
      success: false,
      message: 'Failed to get stream keys',
      error: error.message
    }
  }
}) 