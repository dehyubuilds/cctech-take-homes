const AWS = require('aws-sdk');
const stripe = require('stripe')('sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0');

// Configure AWS with hardcoded credentials
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = 'Twilly';

exports.handler = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  try {
    const body = JSON.parse(event.body);
    const { subscriptionId, channelId, amount, subscriberId } = body;
    
    if (!subscriptionId || !channelId || !amount || !subscriberId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Missing required fields: subscriptionId, channelId, amount, subscriberId'
        })
      };
    }
    
    console.log('Processing subscription payment:', { subscriptionId, channelId, amount, subscriberId });
    
    // Get channel owner information
    const channelOwnerResult = await dynamodb.get({
      TableName: tableName,
      Key: {
        PK: `CHANNEL#${channelId}`,
        SK: 'OWNER'
      }
    }).promise();
    
    if (!channelOwnerResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Channel owner not found'
        })
      };
    }
    
    const channelOwner = channelOwnerResult.Item;
    
    // Get channel owner's Stripe Connect account
    const ownerStripeResult = await dynamodb.get({
      TableName: tableName,
      Key: {
        PK: `USER#${channelOwner.userId}`,
        SK: 'STRIPE_CONNECT'
      }
    }).promise();
    
    if (!ownerStripeResult.Item || ownerStripeResult.Item.status !== 'connected') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Channel owner does not have active payout account'
        })
      };
    }
    
    // Get active collaborators for this channel
    const collaboratorsResult = await dynamodb.query({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `CHANNEL#${channelId}`,
        ':sk': 'COLLABORATOR#'
      }
    }).promise();
    
    const activeCollaborators = collaboratorsResult.Items.filter(collab => collab.status === 'active');
    
    // Calculate PPV revenue splits according to new model:
    // Platform: 10%, Channel Owner: 70%, Collaborators: 15%, Affiliates: 5%
    const platformFee = Math.round(amount * 0.10); // 10% platform fee
    const channelOwnerShare = Math.round(amount * 0.70); // 70% to channel owner
    const collaboratorShare = Math.round(amount * 0.15); // 15% split among collaborators
    const affiliateShare = Math.round(amount * 0.05); // 5% to affiliate marketers
    
    console.log('PPV Revenue split calculation:', {
      totalAmount: amount,
      platformFee,
      channelOwnerShare,
      collaboratorShare,
      affiliateShare,
      collaboratorCount: activeCollaborators.length
    });
    
    // Transfer funds to channel owner
    let ownerTransfer;
    try {
      ownerTransfer = await stripe.transfers.create({
        amount: channelOwnerShare,
        currency: 'usd',
        destination: ownerStripeResult.Item.stripeAccountId,
        description: `Revenue share for channel ${channelId}`,
        metadata: {
          subscriptionId,
          channelId,
          type: 'owner_share'
        }
      });
      console.log('Owner transfer created:', ownerTransfer.id);
    } catch (error) {
      console.error('Error transferring to owner:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify({
          success: false,
          message: 'Failed to transfer funds to channel owner',
          error: error.message
        })
      };
    }
    
    // Transfer funds to collaborators (if any)
    const collaboratorTransfers = [];
    if (activeCollaborators.length > 0) {
      const collaboratorAmount = Math.round(collaboratorShare / activeCollaborators.length);
      
      for (const collaborator of activeCollaborators) {
        // Get collaborator's Stripe Connect account
        const collaboratorStripeResult = await dynamodb.get({
          TableName: tableName,
          Key: {
            PK: `USER#${collaborator.userId}`,
            SK: 'STRIPE_CONNECT'
          }
        }).promise();
        
        if (collaboratorStripeResult.Item && collaboratorStripeResult.Item.status === 'connected') {
          try {
            const transfer = await stripe.transfers.create({
              amount: collaboratorAmount,
              currency: 'usd',
              destination: collaboratorStripeResult.Item.stripeAccountId,
              description: `Collaborator revenue share for channel ${channelId}`,
              metadata: {
                subscriptionId,
                channelId,
                collaboratorId: collaborator.userId,
                type: 'collaborator_share'
              }
            });
            
            collaboratorTransfers.push({
              collaboratorId: collaborator.userId,
              transferId: transfer.id,
              amount: collaboratorAmount
            });
            
            console.log('Collaborator transfer created:', transfer.id);
          } catch (error) {
            console.error('Error transferring to collaborator:', collaborator.userId, error);
            // Continue with other collaborators even if one fails
          }
        } else {
          console.log('Collaborator does not have active payout account:', collaborator.userId);
        }
      }
    }
    
    // Store subscription record in DynamoDB
    const subscriptionRecord = {
      PK: `SUBSCRIPTION#${subscriptionId}`,
      SK: 'DETAILS',
      subscriptionId,
      channelId,
      subscriberId,
      amount,
      platformFee,
      ownerShare,
      collaboratorShare,
      ownerTransferId: ownerTransfer.id,
      collaboratorTransfers,
      processedAt: new Date().toISOString(),
      status: 'completed'
    };
    
    await dynamodb.put({
      TableName: tableName,
      Item: subscriptionRecord
    }).promise();
    
    console.log('Subscription payment processed successfully');
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        message: 'Subscription payment processed successfully',
        subscriptionId,
        platformFee,
        ownerShare,
        collaboratorShare,
        ownerTransferId: ownerTransfer.id,
        collaboratorTransfers: collaboratorTransfers.length
      })
    };
    
  } catch (error) {
    console.error('Error processing subscription payment:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        message: 'Failed to process subscription payment',
        error: error.message
      })
    };
  }
}; 