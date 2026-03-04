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
    const { subscriberEmail, creatorEmail, creatorUsername } = body;

    if (!subscriberEmail || !creatorEmail || !creatorUsername) {
      return {
        success: false,
        message: 'Missing required fields: subscriberEmail, creatorEmail, creatorUsername'
      };
    }

    console.log('💰 [create-premium-subscription] Creating subscription:', { subscriberEmail, creatorEmail, creatorUsername });

    // Get creator's premium settings
    const premiumSettingsResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${creatorEmail}`,
        SK: 'PREMIUM_SETTINGS'
      }
    }).promise();

    if (!premiumSettingsResult.Item || !premiumSettingsResult.Item.subscriptionPrice) {
      return {
        success: false,
        message: 'Creator has not set up Premium subscription pricing'
      };
    }

    const subscriptionPrice = premiumSettingsResult.Item.subscriptionPrice;

    // Check if creator has active Stripe Connect account
    const stripeResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${creatorEmail}`,
        SK: 'STRIPE_CONNECT'
      }
    }).promise();

    if (!stripeResult.Item || !stripeResult.Item.stripeAccountId) {
      return {
        success: false,
        message: 'Creator has not set up Stripe account'
      };
    }

    // Check if subscription already exists
    const existingSubscription = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${creatorEmail}`,
        SK: `SUBSCRIPTION#${subscriberEmail}`
      }
    }).promise();

    if (existingSubscription.Item && (existingSubscription.Item.status === 'active' || existingSubscription.Item.status === 'trialing')) {
      return {
        success: false,
        message: 'Subscription already exists',
        subscriptionId: existingSubscription.Item.subscriptionId,
        isSubscribed: true
      };
    }

    // Calculate platform fee (10%)
    const platformFeePercent = 0.10;
    const platformFee = subscriptionPrice * platformFeePercent;
    const creatorAmount = subscriptionPrice - platformFee;

    // Create Stripe Checkout session with platform fee
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${creatorUsername} Premium Subscription`,
              description: `Premium access to ${creatorUsername}'s content`,
              images: ['https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png']
            },
            unit_amount: Math.round(subscriptionPrice * 100), // Convert to cents
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
        subscriberEmail,
        creatorEmail,
        creatorUsername,
        subscriptionPrice: subscriptionPrice.toString(),
        platformFee: platformFee.toString(),
        creatorAmount: creatorAmount.toString()
      },
      customer_email: subscriberEmail,
      payment_intent_data: {
        application_fee_amount: Math.round(platformFee * 100), // Platform fee in cents
        on_behalf_of: stripeResult.Item.stripeAccountId,
        transfer_data: {
          destination: stripeResult.Item.stripeAccountId
        }
      },
      allow_promotion_codes: true
    });

    // Store subscription record in DynamoDB
    const subscriptionRecord = {
      PK: `USER#${creatorEmail}`,
      SK: `SUBSCRIPTION#${subscriberEmail}`,
      subscriptionId: session.id,
      subscriberEmail,
      creatorEmail,
      creatorUsername,
      amount: subscriptionPrice,
      platformFee,
      creatorAmount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      stripeSessionId: session.id
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: subscriptionRecord
    }).promise();

    // Reverse index: so get-content can query "creators I subscribe to" for premium timeline
    // PK = USER#subscriberEmail, SK = SUBSCRIBED_CREATOR#creatorEmail; status starts pending, webhook sets active
    await dynamodb.put({
      TableName: 'Twilly',
      Item: {
        PK: `USER#${subscriberEmail.toLowerCase()}`,
        SK: `SUBSCRIBED_CREATOR#${creatorEmail.toLowerCase()}`,
        creatorEmail: creatorEmail.toLowerCase(),
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    }).promise();
    await dynamodb.put({
      TableName: 'Twilly',
      Item: {
        PK: `CREATOR_SUBSCRIBERS#${creatorEmail.toLowerCase()}`,
        SK: `SUBSCRIBER#${subscriberEmail.toLowerCase()}`,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    }).promise();
    console.log('✅ [create-premium-subscription] Reverse indexes SUBSCRIBED_CREATOR + CREATOR_SUBSCRIBERS written');

    console.log('✅ [create-premium-subscription] Subscription checkout session created:', session.id);

    return {
      success: true,
      message: 'Subscription checkout session created',
      checkoutUrl: session.url,
      sessionId: session.id,
      subscriptionPrice,
      platformFee,
      creatorAmount
    };

  } catch (error) {
    console.error('❌ [create-premium-subscription] Error:', error);
    return {
      success: false,
      message: 'Failed to create subscription',
      error: error.message
    };
  }
});
