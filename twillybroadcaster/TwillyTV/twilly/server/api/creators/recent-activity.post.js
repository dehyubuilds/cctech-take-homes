import AWS from 'aws-sdk'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { userId } = body

    // Check if user is authenticated
    const user = event.context.auth?.user
    if (!user) {
      return {
        success: false,
        error: 'Unauthorized'
      }
    }

    const userIdentifier = userId || user.attributes.sub

    // Configure AWS
    AWS.config.update({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    })

    const dynamodb = new AWS.DynamoDB.DocumentClient()

    // Get recent files uploaded
    const filesParams = {
      TableName: 'Files',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userIdentifier}`
      },
      ScanIndexForward: false, // Most recent first
      Limit: 10
    }

    const filesResult = await dynamodb.query(filesParams).promise()
    const files = filesResult.Items || []

    // Convert files to activity items
    const activities = files.map(file => ({
      id: file.SK,
      type: 'upload',
      title: 'Content Uploaded',
      description: `Uploaded "${file.fileName || 'New content'}"`,
      time: formatTimeAgo(file.createdAt),
      amount: null,
      icon: 'heroicons:video-camera'
    }))

    // TODO: Add sales/purchase activities
    // Example:
    // const salesParams = {
    //   TableName: 'Transactions',
    //   KeyConditionExpression: 'creatorId = :creatorId',
    //   ExpressionAttributeValues: {
    //     ':creatorId': userIdentifier
    //   },
    //   ScanIndexForward: false,
    //   Limit: 10
    // }
    // const salesResult = await dynamodb.query(salesParams).promise()
    // const sales = salesResult.Items || []
    // 
    // const salesActivities = sales.map(sale => ({
    //   id: sale.transactionId,
    //   type: 'sale',
    //   title: 'Content Sold',
    //   description: `Sold "${sale.contentTitle}" to ${sale.buyerName}`,
    //   time: formatTimeAgo(sale.createdAt),
    //   amount: sale.amount,
    //   icon: 'heroicons:currency-dollar'
    // }))
    // 
    // activities.push(...salesActivities)

    // TODO: Add payout activities
    // Example:
    // const payoutActivities = payouts.map(payout => ({
    //   id: payout.id,
    //   type: 'payout',
    //   title: 'Payout Received',
    //   description: `Payout processed to your bank account`,
    //   time: formatTimeAgo(payout.created),
    //   amount: payout.amount / 100,
    //   icon: 'heroicons:banknotes'
    // }))
    // 
    // activities.push(...payoutActivities)

    // Sort activities by time (most recent first)
    activities.sort((a, b) => new Date(b.time) - new Date(a.time))

    return {
      success: true,
      activities: activities.slice(0, 10) // Return only the 10 most recent
    }

  } catch (error) {
    console.error('Error fetching recent activity:', error)
    return {
      success: false,
      error: error.message || 'Failed to fetch recent activity'
    }
  }
})

function formatTimeAgo(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)

  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }
} 