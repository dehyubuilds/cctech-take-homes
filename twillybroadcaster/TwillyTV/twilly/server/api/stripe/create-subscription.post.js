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
    const { channelId, subscriberId, subscriberEmail, amount, channelName, creatorUsername } = body;

    if (!channelId || !subscriberId || !subscriberEmail || !amount) {
      return {
        success: false,
        message: 'Missing required fields: channelId, subscriberId, subscriberEmail, amount'
      };
    }

    console.log('Creating subscription for:', { channelId, subscriberId, subscriberEmail, amount });

    // Get channel owner information
    const channelOwnerResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `CHANNEL#${channelId}`,
        SK: 'OWNER'
      }
    }).promise();

    let channelOwner;
    
    if (!channelOwnerResult.Item) {
      // Channel doesn't exist, create it
      console.log('Channel not found, creating new channel:', channelId);
      
      // Extract creator email from creatorUsername (which is actually the email)
      const creatorEmail = creatorUsername;
      
      // Create channel owner record using the same format as the series page
      channelOwner = {
        PK: `CHANNEL#${channelId}`,
        SK: 'OWNER',
        channelId,
        channelName,
        userId: creatorEmail, // Use email as userId
        creatorUsername,
        email: creatorEmail, // Store the email for consistency
        series: channelName, // Store the series name
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Store the channel owner record
      await dynamodb.put({
        TableName: 'Twilly',
        Item: channelOwner
      }).promise();
      
      console.log('Created channel owner record:', channelOwner);
    } else {
      channelOwner = channelOwnerResult.Item;
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${channelName} Subscription`,
              description: `Access to ${channelName} by ${creatorUsername}`,
              images: ['https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png']
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: `https://twilly.app/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://twilly.app/subscription/cancel`,
      metadata: {
        channelId,
        subscriberId,
        subscriberEmail,
        channelName,
        creatorUsername,
        creatorId: channelOwner.userId
      },
      customer_email: subscriberEmail,
      allow_promotion_codes: true
    });

    // Store subscription record in DynamoDB
    const subscriptionRecord = {
      PK: `SUBSCRIPTION#${session.id}`,
      SK: 'DETAILS',
      subscriptionId: session.id,
      channelId,
      subscriberId,
      subscriberEmail,
      amount,
      channelName,
      creatorUsername,
      creatorId: channelOwner.userId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      stripeSessionId: session.id
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: subscriptionRecord
    }).promise();

    // ALSO create the subscriber access record immediately (like payouts do)
    const subscriberAccessRecord = {
      PK: `SUBSCRIBER#${subscriberId}`,
      SK: `CHANNEL#${channelId}`,
      subscriberId,
      subscriberEmail,
      channelId,
      channelName,
      creatorUsername,
      creatorId: channelOwner.userId,
      subscriptionId: session.id,
      status: 'pending',
      subscribedAt: new Date().toISOString()
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: subscriberAccessRecord
    }).promise();

    console.log('Subscription created:', session.id);
    console.log('Subscriber access record created immediately');

    return {
      success: true,
      message: 'Subscription checkout session created',
      sessionId: session.id,
      checkoutUrl: session.url
    };

  } catch (error) {
    console.error('Error creating subscription:', error);
    return {
      success: false,
      message: 'Failed to create subscription',
      error: error.message
    };
  }
}); 