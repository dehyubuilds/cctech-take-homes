import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const table = 'Twilly';

  try {
    const body = await readBody(event);
    const { channelId, userId } = body;

    console.log('Get referral link request:', { channelId, userId });

    // Validate required fields
    if (!channelId || !userId) {
      return {
        success: false,
        message: 'Missing required fields: channelId, userId'
      };
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

      hasPayoutSetup = stripeResult.Item && (stripeResult.Item.isActive || stripeResult.Item.status === 'connected');
      console.log('Payout setup status for user:', userId, 'hasPayoutSetup:', hasPayoutSetup);
    } catch (error) {
      console.error('Error checking Stripe Connect status:', error);
      return {
        success: false,
        message: 'Unable to verify payout setup status'
      };
    }

    // ❌ Block if no payout setup
    if (!hasPayoutSetup) {
      return {
        success: false,
        message: 'Payout setup required',
        errorCode: 'PAYOUT_SETUP_REQUIRED'
      };
    }

    // Get casting director record
    try {
      const castingDirectorResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelId}`,
          SK: `CASTING_DIRECTOR#${userId}`
        }
      }).promise();

      if (!castingDirectorResult.Item) {
        return {
          success: false,
          message: 'Casting director not found'
        };
      }

      const castingDirector = castingDirectorResult.Item;

      // Update the casting director record to reflect payout setup completion
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: `CHANNEL#${channelId}`,
          SK: `CASTING_DIRECTOR#${userId}`
        },
        UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
        ExpressionAttributeValues: {
          ':hasPayoutSetup': true,
          ':payoutSetupRequired': false
        }
      }).promise();

      // Also update the user's casting director record
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: `USER#${userId}`,
          SK: `CASTING_DIRECTOR_ROLE#${channelId}`
        },
        UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
        ExpressionAttributeValues: {
          ':hasPayoutSetup': true,
          ':payoutSetupRequired': false
        }
      }).promise();

      console.log('Referral link provided for user:', userId, 'channel:', channelId);

      return {
        success: true,
        message: 'Referral link retrieved successfully',
        referralCode: castingDirector.referralCode,
        referralLink: castingDirector.referralLink,
        castingDirector: {
          channelId: castingDirector.channelId,
          channelName: castingDirector.channelName,
          referralCode: castingDirector.referralCode,
          referralLink: castingDirector.referralLink,
          joinedAt: castingDirector.joinedAt,
          hasPayoutSetup: true,
          payoutSetupRequired: false
        }
      };

    } catch (error) {
      console.error('Error getting casting director record:', error);
      return {
        success: false,
        message: 'Failed to retrieve casting director record'
      };
    }

  } catch (error) {
    console.error('Error in get referral link:', error);
    return {
      success: false,
      message: 'Failed to get referral link'
    };
  }
});
