import AWS from 'aws-sdk';
import Stripe from 'stripe';

const stripe = new Stripe('sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0');

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  
  try {
    const body = await readBody(event);
    const { sessionId } = body;

    if (!sessionId) {
      return {
        success: false,
        message: 'Missing required field: sessionId'
      };
    }

    console.log('Getting session details for:', sessionId);

    // Get session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session) {
      return {
        success: false,
        message: 'Session not found'
      };
    }

    // Get subscription details from DynamoDB
    const subscriptionResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `SUBSCRIPTION#${sessionId}`,
        SK: 'DETAILS'
      }
    }).promise();

    if (!subscriptionResult.Item) {
      return {
        success: false,
        message: 'Subscription not found'
      };
    }

    const subscription = subscriptionResult.Item;

    return {
      success: true,
      subscription: {
        id: subscription.subscriptionId,
        channelName: subscription.channelName,
        creatorUsername: subscription.creatorUsername,
        status: subscription.status,
        amount: subscription.amount,
        subscribedAt: subscription.createdAt
      }
    };

  } catch (error) {
    console.error('Error getting session details:', error);
    return {
      success: false,
      message: 'Failed to get session details',
      error: error.message
    };
  }
}); 