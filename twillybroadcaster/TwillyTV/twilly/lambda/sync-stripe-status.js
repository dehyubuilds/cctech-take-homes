const AWS = require('aws-sdk');
const Stripe = require('stripe');

const stripe = new Stripe('sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0');

exports.handler = async (event) => {
  // Configure AWS
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const tableName = 'Twilly';

  try {
    const body = JSON.parse(event.body);
    const { userId } = body;

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
          message: 'Missing userId'
        })
      };
    }

    console.log('Syncing status for user:', userId);

    // Get the user's Stripe Connect record from DynamoDB
    const result = await dynamodb.get({
      TableName: tableName,
      Key: {
        PK: `USER#${userId}`,
        SK: 'STRIPE_CONNECT'
      }
    }).promise();

    if (!result.Item || !result.Item.stripeAccountId) {
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
          message: 'No Stripe Connect account found for user'
        })
      };
    }

    const stripeAccountId = result.Item.stripeAccountId;
    console.log('Found Stripe account ID:', stripeAccountId);

    // Get the current status from Stripe
    const account = await stripe.accounts.retrieve(stripeAccountId);
    console.log('Stripe account status:', {
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted
    });

    // Determine the status
    let status = 'pending';
    if (account.charges_enabled && account.payouts_enabled) {
      status = 'connected';
    } else if (account.details_submitted) {
      status = 'pending';
    } else {
      status = 'not_connected';
    }

    console.log('Updating status to:', status);

    // Update the status in DynamoDB
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

    console.log('Status updated successfully');

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
        accountId: stripeAccountId,
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
}; 