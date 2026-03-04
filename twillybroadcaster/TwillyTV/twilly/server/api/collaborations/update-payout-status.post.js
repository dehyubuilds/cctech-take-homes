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

    console.log('Updating collaborator payout status:', { userId, userEmail });

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

    // Find all collaborator roles for this user
    const collaboratorRolesResult = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'COLLABORATOR_ROLE#'
      }
    }).promise();

    const collaboratorRoles = collaboratorRolesResult.Items || [];
    console.log('Found collaborator roles:', collaboratorRoles.length);

    // Update each collaborator role with current payout status
    for (const role of collaboratorRoles) {
      // Update the user's collaborator record
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

      // Also update the channel's collaborator record
      const channelCollaboratorKey = `CHANNEL#${role.channelId}`;
      const channelCollaboratorSK = `COLLABORATOR#${userId}`;
      
      await dynamodb.update({
        TableName: table,
        Key: {
          PK: channelCollaboratorKey,
          SK: channelCollaboratorSK
        },
        UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
        ExpressionAttributeValues: {
          ':hasPayoutSetup': hasPayoutSetup,
          ':payoutSetupRequired': !hasPayoutSetup
        }
      }).promise();
    }

    console.log('Updated collaborator payout status for', collaboratorRoles.length, 'roles');

    return {
      success: true,
      message: 'Collaborator payout status updated successfully',
      updatedRoles: collaboratorRoles.length,
      hasPayoutSetup: hasPayoutSetup
    };

  } catch (error) {
    console.error('Error updating collaborator payout status:', error);
    return {
      success: false,
      message: 'Failed to update collaborator payout status'
    };
  }
});