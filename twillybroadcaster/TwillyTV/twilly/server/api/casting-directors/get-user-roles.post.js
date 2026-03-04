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
    const { userId } = body;

    console.log('Get user casting director roles for user:', userId);

    // Validate required fields
    if (!userId) {
      return {
        success: false,
        message: 'Missing required field: userId'
      };
    }

    // Query for user's casting director roles (following collaborator pattern)
    const castingDirectorParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CASTING_DIRECTOR_ROLE#'
      }
    };

    const castingDirectorResult = await dynamodb.query(castingDirectorParams).promise();
    const castingDirectorRoles = castingDirectorResult.Items || [];

    console.log('Found casting director roles:', castingDirectorRoles.length);

    // Check current payout status and update casting director records
    if (castingDirectorRoles.length > 0) {
      try {
        // Get current Stripe Connect status
        const stripeResult = await dynamodb.get({
          TableName: table,
          Key: {
            PK: `USER#${userId}`,
            SK: 'STRIPE_CONNECT'
          }
        }).promise();

        const hasPayoutSetup = stripeResult.Item && (stripeResult.Item.isActive || stripeResult.Item.status === 'connected');
        const payoutSetupRequired = !hasPayoutSetup;

        console.log('Current payout status:', { hasPayoutSetup, payoutSetupRequired });

        // Update each casting director record with current payout status
        for (const role of castingDirectorRoles) {
          role.hasPayoutSetup = hasPayoutSetup;
          role.payoutSetupRequired = payoutSetupRequired;

          // Update the record in DynamoDB
          await dynamodb.update({
            TableName: table,
            Key: {
              PK: role.PK,
              SK: role.SK
            },
            UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
            ExpressionAttributeValues: {
              ':hasPayoutSetup': hasPayoutSetup,
              ':payoutSetupRequired': payoutSetupRequired
            }
          }).promise();

          // Also update the channel's casting director record
          const channelCastingDirectorKey = `CHANNEL#${role.channelId}`;
          const channelCastingDirectorSK = `CASTING_DIRECTOR#${userId}`;
          
          await dynamodb.update({
            TableName: table,
            Key: {
              PK: channelCastingDirectorKey,
              SK: channelCastingDirectorSK
            },
            UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
            ExpressionAttributeValues: {
              ':hasPayoutSetup': hasPayoutSetup,
              ':payoutSetupRequired': payoutSetupRequired
            }
          }).promise();
        }

        console.log('Updated casting director records with current payout status');
      } catch (error) {
        console.error('Error updating casting director payout status:', error);
      }
    }

    return {
      success: true,
      message: 'Casting director roles retrieved successfully',
      castingDirectorRoles: castingDirectorRoles
    };

  } catch (error) {
    console.error('Error getting user casting director roles:', error);
    return {
      success: false,
      message: 'Failed to retrieve casting director roles'
    };
  }
});
