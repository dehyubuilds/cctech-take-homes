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
    const { userEmail, username } = body

    if (!userEmail && !username) {
      throw new Error('Missing userEmail or username parameter')
    }

    let targetEmail = userEmail

    // If username is provided, look up the email for that username
    if (username && !userEmail) {
      try {
        const userQuery = {
          TableName: 'Twilly',
          KeyConditionExpression: 'PK = :pk',
          FilterExpression: 'username = :username',
          ExpressionAttributeValues: {
            ':pk': 'USER',
            ':username': username
          }
        }
        
        const userResult = await dynamodb.query(userQuery).promise()
        if (userResult.Items && userResult.Items.length > 0) {
          targetEmail = userResult.Items[0].email
          console.log('Found email for username:', username, '→', targetEmail)
        } else {
          console.log('No user found for username:', username)
          throw new Error('User not found for username: ' + username)
        }
      } catch (error) {
        console.error('Error finding email for username:', error)
        throw new Error('Failed to find email for username: ' + username)
      }
    }

    // Query for collaborator requests for this user
    const queryParams = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${targetEmail}`,
        ':skPrefix': 'COLLAB_REQUEST#'
      }
    }

    console.log('Querying for collaborator requests with params:', queryParams)
    const result = await dynamodb.query(queryParams).promise()
    console.log('Query result:', result)
    
    // Sort by creation date (newest first)
    const requests = result.Items.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    )
    
    console.log('Found requests:', requests.length)

    return {
      success: true,
      requests: requests
    }

  } catch (error) {
    console.error('Error fetching collaborator requests:', error)
    return {
      success: false,
      message: error.message || 'Failed to fetch collaborator requests',
      requests: []
    }
  }
}) 