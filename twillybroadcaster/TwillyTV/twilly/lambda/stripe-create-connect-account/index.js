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
    
    if (!userId) {
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
          message: 'Missing required field: userId'
        })
      };
    }
    
    // If only userId is provided (no email/username), this is a sync operation
    if (!email) {
      console.log('Syncing status for user:', userId);
      return await syncStripeStatus(userId);
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
        
        // Ensure reverse lookup exists for existing accounts
        try {
          await dynamodb.put({
            TableName: tableName,
            Item: {
              PK: `STRIPE_ACCOUNT#${existingAccount.Item.stripeAccountId}`,
              SK: 'USER_REF',
              userId: userId,
              email: email,
              createdAt: new Date().toISOString()
            }
          }).promise();
        } catch (error) {
          console.log('Reverse lookup already exists or error creating it:', error.message);
        }
        
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
            refresh_url: 'https://twilly.app/account?section=payouts',
            return_url: 'https://twilly.app/account?section=payouts',
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
        url: 'https://twilly.app',
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

    // Create reverse lookup for efficient webhook processing
    await dynamodb.put({
      TableName: tableName,
      Item: {
        PK: `STRIPE_ACCOUNT#${account.id}`,
        SK: 'USER_REF',
        userId: userId,
        email: email,
        createdAt: new Date().toISOString()
      }
    }).promise();
    
    // Create account link for onboarding
    const accountLinks = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://twilly.app/account?section=payouts',
      return_url: 'https://twilly.app/account?section=payouts',
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

// Sync function to update Stripe Connect account status
async function syncStripeStatus(userId) {
  try {
    console.log('Syncing status for user:', userId);
    
    // Get the user's Stripe Connect account from DynamoDB
    const result = await dynamodb.get({
      TableName: tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: 'STRIPE_CONNECT'
      }
    }).promise();

    if (!result.Item || !result.Item.stripeAccountId) {
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
          status: 'not_connected',
          message: 'No Stripe Connect account found'
        })
      };
    }

    // Get the current status from Stripe
    const account = await stripe.accounts.retrieve(result.Item.stripeAccountId);
    const status = account.charges_enabled && account.payouts_enabled ? 'connected' : 'pending';
    
    // Update the status in DynamoDB with proper reserved keyword handling
    await dynamodb.update({
      TableName: tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: 'STRIPE_CONNECT'
      },
      UpdateExpression: 'SET #st = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#st': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': new Date().toISOString()
      }
    }).promise();

    console.log('Updated status to:', status);
    
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
        status: status,
        accountId: result.Item.stripeAccountId,
        message: 'Status synced successfully'
      })
    };
    
  } catch (error) {
    console.error('Error syncing status:', error);
    
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
        message: 'Failed to sync status',
        error: error.message
      })
    };
  }
} 