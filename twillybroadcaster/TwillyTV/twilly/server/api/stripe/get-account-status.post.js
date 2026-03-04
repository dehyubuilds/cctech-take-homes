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
    const { userId } = body;

    if (!userId) {
      return {
        success: false,
        message: 'Missing required field: userId'
      };
    }

    console.log('Checking Stripe Connect status for user:', userId);

    // Get the user's Stripe Connect account from DynamoDB
    const result = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${userId}`,
        SK: 'STRIPE_CONNECT'
      }
    }).promise();

    if (!result.Item) {
      return {
        success: true,
        status: 'not_connected',
        message: 'No Stripe Connect account found'
      };
    }

    const stripeAccount = result.Item;
    
    // If account is connected, fetch the dashboard URL from Stripe
    let dashboardUrl = null;
    if (stripeAccount.status === 'connected' && stripeAccount.stripeAccountId) {
      try {
        const account = await stripe.accounts.retrieve(stripeAccount.stripeAccountId);
        dashboardUrl = account.dashboard_url;
      } catch (error) {
        console.error('Error fetching dashboard URL from Stripe:', error);
      }
    }
    
    return {
      success: true,
      status: stripeAccount.status || 'pending',
      accountId: stripeAccount.stripeAccountId,
      dashboardUrl: dashboardUrl,
      message: 'Stripe Connect account found'
    };

  } catch (error) {
    console.error('Error checking Stripe Connect status:', error);
    return {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
}); 