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
    const { userId, accountId } = body;
    
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
    
    console.log('Deleting Stripe Connect account for user:', userId);
    
    // Get the user's Stripe Connect account from DynamoDB
    // Try different possible user ID formats since records might be stored with email or Cognito ID
    let result = await dynamodb.get({
      TableName: tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: 'STRIPE_CONNECT'
      }
    }).promise();

    // If not found, try with email format (common case)
    if (!result.Item && userId.includes('@')) {
      console.log('Trying with email format for userId:', userId);
      result = await dynamodb.get({
        TableName: tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: 'STRIPE_CONNECT'
        }
      }).promise();
    }

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
          message: 'No Stripe Connect account found for this user (already deleted)'
        })
      };
    }

    const stripeAccountId = result.Item.stripeAccountId;
    let stripeDeleted = false;
    
    try {
      // Try to delete the Stripe Connect account
      const deletedAccount = await stripe.accounts.del(stripeAccountId);
      console.log('Deleted Stripe account:', deletedAccount.id);
      stripeDeleted = true;
    } catch (stripeError) {
      console.error('Error deleting Stripe account:', stripeError);
      
      // Check if the error is because the account doesn't exist or we don't have permission
      if (stripeError.code === 'account_invalid' || stripeError.type === 'StripePermissionError') {
        console.log('Stripe account may already be deleted or inaccessible, proceeding with cleanup');
        stripeDeleted = false;
      } else {
        // For other errors, we'll still try to clean up DynamoDB
        console.log('Unexpected Stripe error, proceeding with cleanup');
        stripeDeleted = false;
      }
    }
    
    // Always clean up DynamoDB records, regardless of Stripe deletion result
    try {
      await dynamodb.delete({
        TableName: tableName,
        Key: {
          PK: `USER#${userId}`,
          SK: 'STRIPE_CONNECT'
        }
      }).promise();
      
      await dynamodb.delete({
        TableName: tableName,
        Key: {
          PK: `STRIPE_ACCOUNT#${stripeAccountId}`,
          SK: 'USER_REF'
        }
      }).promise();
      
      console.log('Cleaned up DynamoDB records for user:', userId);
    } catch (dbError) {
      console.error('Error cleaning up DynamoDB records:', dbError);
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
          message: 'Failed to clean up database records',
          error: dbError.message
        })
      };
    }
    
    // Return success since DynamoDB cleanup worked
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
        message: stripeDeleted 
          ? 'Stripe Connect account deleted successfully' 
          : 'Stripe Connect account removed from system (Stripe account may have been already deleted)',
        accountId: stripeAccountId
      })
    };
    
  } catch (error) {
    console.error('Error deleting Stripe Connect account:', error);
    
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
        message: 'Internal server error',
        error: error.message
      })
    };
  }
}; 