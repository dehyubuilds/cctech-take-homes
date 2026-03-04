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
      const { creatorUsername, channel } = body || {}

      if (!creatorUsername || !channel) {
        throw new Error('creatorUsername and channel are required')
      }

      console.log('Public API called with:', { creatorUsername, channel })

    // Query public index and filter by creator/channel
    const queryParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: 'creatorUsername = :username AND channel = :channel',
      ExpressionAttributeValues: {
        ':pk': 'PUBLIC_TALENT_REQUESTS',
        ':skPrefix': 'REQUEST#',
        ':username': creatorUsername,
        ':channel': channel
      }
    }

    const result = await dynamodb.query(queryParams).promise()

    const requests = (result.Items || []).sort((a, b) => {
      const aDate = new Date(a.createdAt || 0)
      const bDate = new Date(b.createdAt || 0)
      return bDate - aDate
    })

    // Also fetch the channel poster from the file store
    let channelPosterUrl = null
    try {
      // First, find the user by username to get their email
      const userQueryParams = {
        TableName: 'Twilly',
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'username = :username',
        ExpressionAttributeValues: {
          ':pk': 'USER',
          ':username': creatorUsername
        }
      }
      
      const userResult = await dynamodb.scan(userQueryParams).promise()
      const user = userResult.Items?.find(item => item.username === creatorUsername)
      
      if (user && user.email) {
        // Now query for the user's channel folder
        const folderQueryParams = {
          TableName: 'Twilly',
          KeyConditionExpression: 'PK = :pk',
          FilterExpression: 'name = :channelName',
          ExpressionAttributeValues: {
            ':pk': `USER#${user.email}`,
            ':channelName': channel
          }
        }
        
        const folderResult = await dynamodb.scan(folderQueryParams).promise()
        
        // Debug: Log all folders found for this user
        console.log('All folders for user:', folderResult.Items?.map(f => ({ name: f.name, hasPoster: !!f.seriesPosterUrl })))
        
        const channelFolder = folderResult.Items?.find(item => 
          item.name === channel && item.seriesPosterUrl
        )
        
        if (channelFolder && channelFolder.seriesPosterUrl) {
          // Convert to public URL format (same as managefiles.vue)
          channelPosterUrl = channelFolder.seriesPosterUrl
            .replace('/series-posters/', '/public/series-posters/')
            .replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net')
          
          console.log('Found channel poster URL:', channelPosterUrl)
        } else {
          console.log('No channel folder or poster found for channel:', channel)
          console.log('Looking for exact match with:', channel)
          
          // Try to find any folder that might match (case-insensitive or partial)
          const possibleMatch = folderResult.Items?.find(item => 
            item.name && item.seriesPosterUrl && 
            (item.name.toLowerCase().includes(channel.toLowerCase()) || 
             channel.toLowerCase().includes(item.name.toLowerCase()))
          )
          
          if (possibleMatch) {
            console.log('Found possible match:', possibleMatch.name)
            channelPosterUrl = possibleMatch.seriesPosterUrl
              .replace('/series-posters/', '/public/series-posters/')
              .replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net')
            console.log('Using possible match poster URL:', channelPosterUrl)
          }
        }
      } else {
        console.log('User not found for username:', creatorUsername)
      }
    } catch (error) {
      console.log('Could not fetch channel poster:', error.message)
    }

    return { 
      success: true, 
      requests,
      channelPosterUrl 
    }
  } catch (error) {
    console.error('Error getting public talent requests by channel:', error)
    return { success: false, message: error.message || 'Failed to load public talent requests' }
  }
})


