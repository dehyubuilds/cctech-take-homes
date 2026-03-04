import AWS from 'aws-sdk';
import Stripe from 'stripe';

const stripe = new Stripe('sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0');

export default defineEventHandler(async (event) => {
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '81v8RfOXhFHoKvOyD5t4IeaVq9ad9TSAnp7eI'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  
  try {
    const body = await readBody(event);
    const { 
      creatorId, 
      clipId, 
      title, 
      description, 
      price, 
      clipUrl, 
      thumbnailUrl,
      category 
    } = body;

    if (!creatorId || !clipId || !title || !price) {
      return {
        success: false,
        message: 'Missing required fields: creatorId, clipId, title, and price are required'
      };
    }

    console.log('Creating checkout session for:', { creatorId, clipId, title, price });

    // Get creator information
    const creatorResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${creatorId}`,
        SK: 'PROFILE'
      }
    }).promise();

    let creatorUsername = creatorId;
    if (creatorResult.Item && creatorResult.Item.username) {
      creatorUsername = creatorResult.Item.username;
    }

    // Get creator's Stripe Connect account (required for destination charges)
    const stripeResult = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${creatorId}`,
        SK: 'STRIPE_CONNECT'
      }
    }).promise();

    if (!stripeResult.Item || !stripeResult.Item.stripeAccountId) {
      return {
        success: false,
        message: 'Creator has not set up Stripe Connect account'
      };
    }

    const creatorStripeAccountId = stripeResult.Item.stripeAccountId;
    const platformFeePercent = 0.15; // 15% platform fee
    const platformFeeAmount = Math.round(price * platformFeePercent * 100); // In cents

    // Get buyer email from request body if provided
    const { buyerEmail } = body;
    
    // Create Stripe Checkout session with DESTINATION CHARGES (automatic payout)
    // Money goes directly to creator, platform fee automatically deducted
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: title,
              description: description || `Digital content from ${creatorUsername}`,
              images: thumbnailUrl ? [thumbnailUrl] : ['https://d3hv50jkrzkiyh.cloudfront.net/twilly-logo.png']
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${process.env.NODE_ENV === 'production' ? 'https://twilly.tv' : 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NODE_ENV === 'production' ? 'https://twilly.tv' : 'http://localhost:3000'}/payment/cancel`,
      customer_email: buyerEmail, // Pre-fill buyer email if provided
      // DESTINATION CHARGES: Money goes directly to creator, platform fee auto-deducted
      payment_intent_data: {
        application_fee_amount: platformFeeAmount, // 15% platform fee (automatically deducted)
        on_behalf_of: creatorStripeAccountId,
        transfer_data: {
          destination: creatorStripeAccountId // Money goes directly to creator's account
        }
      },
      metadata: {
        creatorId,
        clipId,
        title,
        category,
        creatorUsername,
        buyerEmail: buyerEmail || '', // Store buyer email in metadata
        creatorStripeAccountId // Store for reference
      },
      allow_promotion_codes: true
    });

    // Store checkout session record in DynamoDB
    const checkoutRecord = {
      PK: `CHECKOUT#${session.id}`,
      SK: 'DETAILS',
      sessionId: session.id,
      creatorId,
      clipId,
      title,
      description,
      price,
      clipUrl,
      thumbnailUrl,
      category,
      creatorUsername,
      buyerEmail: buyerEmail || null, // Store buyer email
      customerEmail: buyerEmail || null, // Also store as customerEmail for webhook lookup
      status: 'pending',
      createdAt: new Date().toISOString(),
      stripeSessionId: session.id
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: checkoutRecord
    }).promise();

    return {
      success: true,
      message: 'Checkout session created successfully',
      checkoutUrl: session.url,
      sessionId: session.id
    };

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      success: false,
      message: 'Failed to create checkout session',
      error: error.message
    };
  }
});
