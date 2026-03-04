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
    const { userId } = body

    console.log('Get user collaborations request:', { userId })

    // Validate required fields
    if (!userId) {
      return {
        success: false,
        message: 'Missing required fields: userId'
      }
    }

    // Query for user's collaborations (try username, email, and Cognito ID)
    try {
      // First try with the provided userId (could be username, email, or Cognito ID)
      let result = await dynamodb.query({
        TableName: table,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'COLLABORATION#'
        }
      }).promise()

      let collaborations = result.Items || [];
      console.log('Found collaborations for user ID:', userId, 'count:', collaborations.length);

      // If no collaborations found, try with email as userId
      if (collaborations.length === 0 && userId.includes('@')) {
        console.log('No collaborations found with user ID, trying with email...');
        result = await dynamodb.query({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'COLLABORATION#'
          }
        }).promise()
        
        collaborations = result.Items || [];
        console.log('Found collaborations with email:', userId, 'count:', collaborations.length);
      }

      // If still no collaborations found, try with username
      if (collaborations.length === 0) {
        console.log('No collaborations found with user ID or email, trying with username...');
        // Try with the provided userId as username
        result = await dynamodb.query({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'COLLABORATION#'
          }
        }).promise()
        
        collaborations = result.Items || [];
        if (collaborations.length > 0) {
          console.log('Found collaborations with username:', userId, 'count:', collaborations.length);
        }
      }

      // If still no collaborations found, try with email
      if (collaborations.length === 0) {
        console.log('No collaborations found with username, trying with email...');
        // Try with email as userId
        result = await dynamodb.query({
          TableName: table,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `USER#dehyu.sinyan@gmail.com`,
            ':sk': 'COLLABORATION#'
          }
        }).promise()
        
        collaborations = result.Items || [];
        if (collaborations.length > 0) {
          console.log('Found collaborations with email: dehyu.sinyan@gmail.com, count:', collaborations.length);
        }
      }

      // Check current payout status and update collaboration records
      if (collaborations.length > 0) {
        try {
          // Get current Stripe Connect status
          const stripeResult = await dynamodb.get({
            TableName: table,
            Key: {
              PK: `USER#dehyu.sinyan@gmail.com`,
              SK: 'STRIPE_CONNECT'
            }
          }).promise();

          const hasPayoutSetup = stripeResult.Item && (stripeResult.Item.isActive || stripeResult.Item.status === 'connected');
          const payoutSetupRequired = !hasPayoutSetup;

          console.log('Current payout status:', { hasPayoutSetup, payoutSetupRequired });

          // Update each collaboration record with current payout status
          for (const collaboration of collaborations) {
            collaboration.hasPayoutSetup = hasPayoutSetup;
            collaboration.payoutSetupRequired = payoutSetupRequired;

            // Update the record in DynamoDB
            await dynamodb.update({
              TableName: table,
              Key: {
                PK: collaboration.PK,
                SK: collaboration.SK
              },
              UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
              ExpressionAttributeValues: {
                ':hasPayoutSetup': hasPayoutSetup,
                ':payoutSetupRequired': payoutSetupRequired
              }
            }).promise();

            // Also update the channel's collaboration record
            const channelCollaborationKey = `CHANNEL#${collaboration.channelId}`;
            const channelCollaborationSK = `COLLABORATION#${userId}`;
            
            await dynamodb.update({
              TableName: table,
              Key: {
                PK: channelCollaborationKey,
                SK: channelCollaborationSK
              },
              UpdateExpression: 'SET hasPayoutSetup = :hasPayoutSetup, payoutSetupRequired = :payoutSetupRequired',
              ExpressionAttributeValues: {
                ':hasPayoutSetup': hasPayoutSetup,
                ':payoutSetupRequired': payoutSetupRequired
              }
            }).promise();
          }

          console.log('Updated collaboration records with current payout status');
        } catch (error) {
          console.error('Error updating collaboration records with payout status:', error);
          // Continue without updating if there's an error
        }
      }

      return {
        success: true,
        message: 'Collaborations retrieved successfully',
        collaborations: collaborations
      }

    } catch (error) {
      console.error('Error querying collaborations:', error)
      return {
        success: false,
        message: 'Failed to retrieve collaborations'
      }
    }

  } catch (error) {
    console.error('Error in get user collaborations:', error)
    return {
      success: false,
      message: 'Internal server error'
    }
  }
}) 