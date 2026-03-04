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
    const { userId, userEmail } = body;

    console.log('Updating casting director payout status:', { userId, userEmail });

    // Check current Stripe Connect status
    let hasPayoutSetup = false;
    try {
      const stripeResult = await dynamodb.get({
        TableName: table,
        Key: {
          PK: `USER#${userEmail}`,
          SK: 'STRIPE_CONNECT'
        }
      }).promise();

      hasPayoutSetup = stripeResult.Item && (stripeResult.Item.isActive || stripeResult.Item.status === 'connected');
      console.log('Current payout status:', { hasPayoutSetup });
    } catch (error) {
      console.error('Error checking Stripe Connect status:', error);
      hasPayoutSetup = false;
    }

    // Find all casting director roles for this user
    const castingDirectorRolesResult = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'CASTING_DIRECTOR_ROLE#'
      }
    }).promise();

    const castingDirectorRoles = castingDirectorRolesResult.Items || [];
    console.log('Found casting director roles:', castingDirectorRoles.length);

    // Update each casting director role with current payout status
    for (const role of castingDirectorRoles) {
      // Update the user's casting director record
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: role.PK,
          SK: role.SK
        },
        UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
        ExpressionAttributeValues: {
          ':hasPayoutSetup': hasPayoutSetup,
          ':payoutSetupRequired': !hasPayoutSetup
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
          ':payoutSetupRequired': !hasPayoutSetup
        }
      }).promise();
    }

    console.log('Updated casting director payout status for', castingDirectorRoles.length, 'roles');

    return {
      success: true,
      message: 'Casting director payout status updated successfully',
      updatedRoles: castingDirectorRoles.length,
      hasPayoutSetup: hasPayoutSetup
    };

  } catch (error) {
    console.error('Error updating casting director payout status:', error);
    return {
      success: false,
      message: 'Failed to update casting director payout status'
    };
  }
});
