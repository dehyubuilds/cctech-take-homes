import AWS from 'aws-sdk';
import Stripe from 'stripe';

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const stripe = new Stripe('sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0');
  
  try {
    const body = await readBody(event);
    const { subscriberId, channelId } = body;

    if (!subscriberId || !channelId) {
      return {
        success: false,
        message: 'Missing required fields: subscriberId, channelId'
      };
    }

    console.log('Checking subscription status for:', { subscriberId, channelId });

    // Get the subscription access record from DynamoDB
    const result = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `SUBSCRIBER#${subscriberId}`,
        SK: `CHANNEL#${channelId}`
      }
    }).promise();

    if (!result.Item) {
      return {
        success: true,
        hasAccess: false,
        status: 'not_subscribed',
        message: 'No subscription found'
      };
    }

    const subscription = result.Item;
    console.log('Found subscription:', subscription);
    
    // If subscription is pending, check from Stripe
    if (subscription.status === 'pending' && subscription.subscriptionId) {
      try {
        console.log('Subscription is pending, checking from Stripe...');
        const session = await stripe.checkout.sessions.retrieve(subscription.subscriptionId);
        console.log('Stripe session status:', session.payment_status, session.status);
        
        if (session.payment_status === 'paid' && session.status === 'complete') {
          // Payment was successful, update the status
          console.log('Payment confirmed from Stripe, updating status to active');
          await dynamodb.update({
            TableName: 'Twilly',
            Key: {
              PK: `SUBSCRIBER#${subscriberId}`,
              SK: `CHANNEL#${channelId}`
            },
            UpdateExpression: 'SET status = :status, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':status': 'active',
              ':updatedAt': new Date().toISOString()
            }
          }).promise();
          
          return {
            success: true,
            hasAccess: true,
            status: 'active',
            message: 'Subscription is active'
          };
        }
      } catch (error) {
        console.error('Error checking Stripe session:', error);
      }
    }
    
    return {
      success: true,
      hasAccess: subscription.status === 'active',
      status: subscription.status,
      message: `Subscription is ${subscription.status}`
    };

  } catch (error) {
    console.error('Error checking subscription status:', error);
    return {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
}); 