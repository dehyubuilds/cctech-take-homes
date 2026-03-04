const stripe = require('stripe')('sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0');

// Configure AWS with hardcoded credentials
const AWS = require('aws-sdk');
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
    const { userId, username, email } = body;
    
    if (!userId || !email) {
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
          message: 'Missing required fields: userId, email'
        })
      };
    }
    
    console.log('Creating Stripe Connect account for:', { userId, username, email });
    
    // Check if user already has a Stripe Connect account
    try {
      const existingAccount = await dynamodb.get({
        TableName: tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: 'STRIPE_CONNECT'
        }
      }).promise();
      
      if (existingAccount.Item && existingAccount.Item.stripeAccountId) {
        console.log('User already has Stripe Connect account:', existingAccount.Item.stripeAccountId);
        
        // Check if the account is active
        const account = await stripe.accounts.retrieve(existingAccount.Item.stripeAccountId);
        
        if (account.charges_enabled && account.payouts_enabled) {
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
              message: 'Stripe Connect account already exists and is active',
              accountId: existingAccount.Item.stripeAccountId,
              status: 'connected',
              dashboardUrl: account.dashboard_url
            })
          };
        } else {
          // Account exists but needs completion
          const accountLinks = await stripe.accountLinks.create({
            account: existingAccount.Item.stripeAccountId,
            refresh_url: 'https://share.twilly.app/account?section=payouts',
            return_url: 'https://share.twilly.app/account?section=payouts',
            type: 'account_onboarding'
          });
          
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
              message: 'Stripe Connect account needs completion',
              accountId: existingAccount.Item.stripeAccountId,
              status: 'pending',
              onboardingUrl: accountLinks.url
            })
          };
        }
      }
    } catch (error) {
      console.error('Error checking existing account:', error);
    }
    
    // Create new Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true }
      },
      business_type: 'individual',
      business_profile: {
        url: 'https://share.twilly.app',
        mcc: '5734' // Computer Software Stores
      }
    });
    
    console.log('Created Stripe Connect account:', account.id);
    
    // Store the account mapping in DynamoDB
    await dynamodb.put({
      TableName: tableName,
      Item: {
        PK: `USER#${userId}`,
        SK: 'STRIPE_CONNECT',
        stripeAccountId: account.id,
        username: username || '',
        email: email,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }).promise();
    
    // Create account link for onboarding
    const accountLinks = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://share.twilly.app/account?section=payouts',
      return_url: 'https://share.twilly.app/account?section=payouts',
      type: 'account_onboarding'
    });
    
    console.log('Created account link:', accountLinks.url);
    
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
        message: 'Stripe Connect account created successfully',
        accountId: account.id,
        status: 'pending',
        onboardingUrl: accountLinks.url
      })
    };
    
  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    
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
        message: 'Failed to create Stripe Connect account',
        error: error.message
      })
    };
  }
}; 