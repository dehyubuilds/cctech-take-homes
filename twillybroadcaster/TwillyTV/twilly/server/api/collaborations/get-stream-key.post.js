import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { channelId, userId } = body

    console.log('Get stream key request:', { channelId, userId })

    // Validate required fields
    if (!channelId || !userId) {
      return {
        success: false,
        message: 'Missing required fields: channelId, userId'
      }
    }

    // ✅ Check payout setup status
    let hasPayoutSetup = false;
    try {
      const stripeResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `USER#${userId}`,
          SK: 'STRIPE_CONNECT'
        }
      }).promise();

      hasPayoutSetup = stripeResult.Item && stripeResult.Item.isActive;
      console.log('Payout setup status for user:', userId, 'hasPayoutSetup:', hasPayoutSetup);
    } catch (error) {
      console.error('Error checking Stripe Connect status:', error);
      return {
        success: false,
        message: 'Unable to verify payout setup status'
      }
    }

    // ❌ Block if no payout setup
    if (!hasPayoutSetup) {
      return {
        success: false,
        message: 'Payout setup required',
        errorCode: 'PAYOUT_SETUP_REQUIRED',
        details: 'You must set up your payout account before accessing stream keys.'
      }
    }

    // Get collaboration record
    try {
      const collaborationResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelId}`,
          SK: `COLLABORATOR#${userId}`
        }
      }).promise()

      if (!collaborationResult.Item) {
        return {
          success: false,
          message: 'Collaboration not found'
        }
      }

      const collaboration = collaborationResult.Item;

      // Update the collaboration record to reflect payout setup completion
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelId}`,
          SK: `COLLABORATOR#${userId}`
        },
        UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
        ExpressionAttributeValues: {
          ':hasPayoutSetup': true,
          ':payoutSetupRequired': false
        }
      }).promise()

      // Also update the user's collaboration record
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: `USER#${userId}`,
          SK: `COLLABORATION#${channelId}`
        },
        UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
        ExpressionAttributeValues: {
          ':hasPayoutSetup': true,
          ':payoutSetupRequired': false
        }
      }).promise()

      console.log('Stream key provided for user:', userId, 'channel:', channelId)

      return {
        success: true,
        message: 'Stream key retrieved successfully',
        streamKey: collaboration.streamKey,
        collaboration: {
          channelId: collaboration.channelId,
          channelName: collaboration.channelName,
          streamKey: collaboration.streamKey,
          joinedAt: collaboration.joinedAt,
          hasPayoutSetup: true,
          payoutSetupRequired: false
        }
      }

    } catch (error) {
      console.error('Error retrieving collaboration:', error)
      return {
        success: false,
        message: 'Failed to retrieve collaboration record'
      }
    }

  } catch (error) {
    console.error('Error in get stream key:', error)
    return {
      success: false,
      message: 'Internal server error'
    }
  }
}) 