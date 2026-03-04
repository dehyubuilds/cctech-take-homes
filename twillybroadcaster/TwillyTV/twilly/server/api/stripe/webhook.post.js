import AWS from 'aws-sdk';
import Stripe from 'stripe';

const stripe = new Stripe('sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0');

export default defineEventHandler(async (event) => {
  console.log('=== WEBHOOK RECEIVED ===');
  console.log('Webhook URL:', event.node.req.url);
  console.log('Webhook method:', event.node.req.method);
  console.log('Webhook headers:', event.node.req.headers);
  
  // Simple test endpoint
  if (event.node.req.method === 'GET') {
    console.log('Webhook test endpoint accessed');
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook endpoint is accessible' })
    };
  }
  
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();
  const lambda = new AWS.Lambda();

  try {
    // Get the raw body for webhook signature verification
    const rawBody = await readRawBody(event);
    const signature = getHeader(event, 'stripe-signature');
    const endpointSecret = 'whsec_d55d2e2b4addc016a941a199be35a6b1437b1a94d84601fb2eb28b8c5a6658d1';

    console.log('Raw body length:', rawBody?.length);
    console.log('Signature header:', signature);
    console.log('Endpoint secret configured:', !!endpointSecret);

    if (!rawBody || !signature) {
      console.error('Missing raw body or signature');
      return createError({
        statusCode: 400,
        statusMessage: 'Missing webhook signature or body'
      });
    }

    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
      console.log('Webhook signature verified successfully');
      console.log('Event type:', stripeEvent.type);
      console.log('Event ID:', stripeEvent.id);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return createError({
        statusCode: 400,
        statusMessage: 'Webhook signature verification failed'
      });
    }

    console.log('Received Stripe webhook event:', stripeEvent.type);
    console.log('Webhook event data:', JSON.stringify(stripeEvent.data, null, 2));

    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        console.log('Handling checkout.session.completed event');
        await handleCheckoutSessionCompleted(stripeEvent.data.object, dynamodb, lambda);
        break;
      
      case 'payment_intent.succeeded':
        console.log('Handling payment_intent.succeeded event');
        await handlePaymentIntentSucceeded(stripeEvent.data.object, dynamodb);
        break;
      
      case 'invoice.payment_succeeded':
        console.log('Handling invoice.payment_succeeded event');
        await handleInvoicePaymentSucceeded(stripeEvent.data.object, dynamodb, lambda);
        break;
      
      case 'invoice.payment_failed':
        console.log('Handling invoice.payment_failed event');
        await handleInvoicePaymentFailed(stripeEvent.data.object, dynamodb);
        break;
      
      case 'customer.subscription.deleted':
        console.log('Handling customer.subscription.deleted event');
        await handleSubscriptionDeleted(stripeEvent.data.object, dynamodb);
        break;
      
      case 'account.updated':
        console.log('Handling account.updated event');
        await handleAccountUpdated(stripeEvent.data.object, dynamodb);
        break;
      
      default:
        console.log('Unhandled event type:', stripeEvent.type);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' })
    };
  }
});

async function handleCheckoutSessionCompleted(session, dynamodb, lambda) {
  console.log('=== PROCESSING CHECKOUT SESSION COMPLETED ===');
  console.log('Session ID:', session.id);
  console.log('Session metadata:', session.metadata);
  console.log('Session customer:', session.customer);
  console.log('Session amount_total:', session.amount_total);
  
  const metadata = session.metadata || {};
  const { channelId, subscriberId, subscriberEmail, channelName, creatorUsername, creatorId, creatorEmail } = metadata;

  // Twilly TV Premium flow: metadata has creatorEmail + subscriberEmail (from create-premium-subscription)
  if (creatorEmail && (subscriberEmail || metadata.subscriberEmail)) {
    const subEmail = (subscriberEmail || metadata.subscriberEmail).toLowerCase();
    const crEmail = creatorEmail.toLowerCase();
    console.log('👑 [webhook] Twilly Premium subscription completed:', { subscriberEmail: subEmail, creatorEmail: crEmail });
    try {
      await dynamodb.update({
        TableName: 'Twilly',
        Key: { PK: `USER#${crEmail}`, SK: `SUBSCRIPTION#${subEmail}` },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'active', ':updatedAt': new Date().toISOString() }
      }).promise();
      await dynamodb.update({
        TableName: 'Twilly',
        Key: { PK: `USER#${subEmail}`, SK: `SUBSCRIBED_CREATOR#${crEmail}` },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'active', ':updatedAt': new Date().toISOString() }
      }).promise();
      await dynamodb.put({
        TableName: 'Twilly',
        Item: {
          PK: `CREATOR_SUBSCRIBERS#${crEmail}`,
          SK: `SUBSCRIBER#${subEmail}`,
          status: 'active',
          updatedAt: new Date().toISOString()
        }
      }).promise();
      console.log('✅ [webhook] Premium subscription and CREATOR_SUBSCRIBERS set to active');
      return;
    } catch (err) {
      console.error('❌ [webhook] Premium subscription update failed:', err);
      throw err;
    }
  }
  
  console.log('Extracted metadata:', { channelId, subscriberId, subscriberEmail, channelName, creatorUsername, creatorId });
  
  try {
    // Update subscription status (channel subscription flow)
    console.log('Updating subscription status for:', session.id);
    const updateResult = await dynamodb.update({
      TableName: 'Twilly',
      Key: {
        PK: `SUBSCRIPTION#${session.id}`,
        SK: 'DETAILS'
      },
      UpdateExpression: 'SET #status = :status, stripeCustomerId = :customerId, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'active',
        ':customerId': session.customer,
        ':updatedAt': new Date().toISOString()
      }
    }).promise();
    console.log('Subscription status update result:', updateResult);

    // Create subscriber access record
    console.log('Creating subscriber access record for:', subscriberId);
    console.log('Access record details:', {
      PK: `SUBSCRIBER#${subscriberId}`,
      SK: `CHANNEL#${channelId}`,
      subscriberId,
      subscriberEmail,
      channelId,
      channelName,
      creatorUsername,
      creatorId,
      subscriptionId: session.id,
      stripeCustomerId: session.customer,
      status: 'active',
      subscribedAt: new Date().toISOString()
    });
    
    const putResult = await dynamodb.put({
      TableName: 'Twilly',
      Item: {
        PK: `SUBSCRIBER#${subscriberId}`,
        SK: `CHANNEL#${channelId}`,
        subscriberId,
        subscriberEmail,
        channelId,
        channelName,
        creatorUsername,
        creatorId,
        subscriptionId: session.id,
        stripeCustomerId: session.customer,
        status: 'active',
        subscribedAt: new Date().toISOString()
      }
    }).promise();
    console.log('Subscriber access record created:', putResult);

    console.log('✅ Subscription activated for subscriber:', subscriberId);
  } catch (error) {
    console.error('❌ Error in handleCheckoutSessionCompleted:', error);
    throw error;
  }
}

async function handleInvoicePaymentSucceeded(invoice, dynamodb, lambda) {
  console.log('Processing successful invoice payment:', invoice.id);
  
  const subscriptionId = invoice.subscription;
  const amount = invoice.amount_paid;
  
  // Get subscription details
  const subscriptionResult = await dynamodb.get({
    TableName: 'Twilly',
    Key: {
      PK: `SUBSCRIPTION#${subscriptionId}`,
      SK: 'DETAILS'
    }
  }).promise();

  if (!subscriptionResult.Item) {
    console.error('Subscription not found:', subscriptionId);
    return;
  }

  const subscription = subscriptionResult.Item;
  
  // Process revenue split via Lambda
  const lambdaParams = {
    FunctionName: 'stripe-subscription-payment',
    InvocationType: 'RequestResponse',
    Payload: JSON.stringify({
      body: JSON.stringify({
        subscriptionId,
        channelId: subscription.channelId,
        amount: amount / 100, // Convert from cents
        subscriberId: subscription.subscriberId
      })
    })
  };

  try {
    const lambdaResponse = await lambda.invoke(lambdaParams).promise();
    console.log('Revenue split processed:', lambdaResponse);
  } catch (error) {
    console.error('Error processing revenue split:', error);
  }
}

async function handleInvoicePaymentFailed(invoice, dynamodb) {
  console.log('Processing failed invoice payment:', invoice.id);
  
  const subscriptionId = invoice.subscription;
  
  // Update subscription status
  await dynamodb.update({
    TableName: 'Twilly',
    Key: {
      PK: `SUBSCRIPTION#${subscriptionId}`,
      SK: 'DETAILS'
    },
    UpdateExpression: 'SET status = :status, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':status': 'past_due',
      ':updatedAt': new Date().toISOString()
    }
  }).promise();

  console.log('Subscription marked as past due:', subscriptionId);
}

async function handleSubscriptionDeleted(subscription, dynamodb) {
  console.log('Processing deleted subscription:', subscription.id);
  
  // Get subscription details
  const subscriptionResult = await dynamodb.get({
    TableName: 'Twilly',
    Key: {
      PK: `SUBSCRIPTION#${subscription.id}`,
      SK: 'DETAILS'
    }
  }).promise();

  if (!subscriptionResult.Item) {
    console.error('Subscription not found:', subscription.id);
    return;
  }

  const subscriptionData = subscriptionResult.Item;
  
  // Update subscription status
  await dynamodb.update({
    TableName: 'Twilly',
    Key: {
      PK: `SUBSCRIPTION#${subscription.id}`,
      SK: 'DETAILS'
    },
    UpdateExpression: 'SET status = :status, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':status': 'cancelled',
      ':updatedAt': new Date().toISOString()
    }
  }).promise();

  // Remove subscriber access
  await dynamodb.delete({
    TableName: 'Twilly',
    Key: {
      PK: `SUBSCRIBER#${subscriptionData.subscriberId}`,
      SK: `CHANNEL#${subscriptionData.channelId}`
    }
  }).promise();

  console.log('Subscription cancelled and access removed:', subscription.id);
}

async function handleAccountUpdated(account, dynamodb) {
  console.log('Processing account update:', account.id);
  
  // Create a reverse lookup record for efficient querying
  // This allows us to find the user by stripeAccountId without scanning
  const reverseLookupKey = `STRIPE_ACCOUNT#${account.id}`;
  
  try {
    // Try to get the reverse lookup record
    const reverseLookup = await dynamodb.get({
      TableName: 'Twilly',
      Key: {
        PK: reverseLookupKey,
        SK: 'USER_REF'
      }
    }).promise();

    if (reverseLookup.Item) {
      const userId = reverseLookup.Item.userId;
      const status = account.charges_enabled && account.payouts_enabled ? 'connected' : 'pending';
      
      // Update account status
      await dynamodb.update({
        TableName: 'Twilly',
        Key: {
          PK: `USER#${userId}`,
          SK: 'STRIPE_CONNECT'
        },
        UpdateExpression: 'SET status = :status, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': new Date().toISOString()
        }
      }).promise();

      console.log('Updated Stripe Connect account status:', account.id, status);
    } else {
      console.log('No reverse lookup found for account:', account.id);
    }
  } catch (error) {
    console.error('Error updating account status:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent, dynamodb) {
  console.log('Processing successful payment intent:', paymentIntent.id);
  
  const sessionId = paymentIntent.metadata?.session_id;
  if (!sessionId) {
    console.log('No session ID found in payment intent metadata');
    return;
  }
  
  // Get checkout session details
  const checkoutResult = await dynamodb.get({
    TableName: 'Twilly',
    Key: {
      PK: `CHECKOUT#${sessionId}`,
      SK: 'DETAILS'
    }
  }).promise();

  if (!checkoutResult.Item) {
    console.error('Checkout session not found:', sessionId);
    return;
  }

  const checkout = checkoutResult.Item;
  const amount = paymentIntent.amount / 100; // Convert from cents
  
  // Get buyer email from payment intent customer
  let buyerEmail = checkout.buyerEmail || paymentIntent.metadata?.buyerEmail;
  if (!buyerEmail && paymentIntent.customer) {
    // Try to get customer email from Stripe if available
    // For now, use the checkout metadata or session customer_email
    buyerEmail = checkout.customerEmail || checkout.buyerEmail;
  }
  
  // CRITICAL: Unlock content for buyer (per-item purchase model)
  if (buyerEmail && checkout.clipId) {
    const normalizedVideoId = checkout.clipId.replace(/^FILE#/, '');
    
    // Create unlock record
    await dynamodb.put({
      TableName: 'Twilly',
      Item: {
        PK: `UNLOCKED#${buyerEmail}`,
        SK: `ITEM#${normalizedVideoId}`,
        videoId: normalizedVideoId,
        clipId: checkout.clipId,
        title: checkout.title,
        creatorId: checkout.creatorId,
        creatorUsername: checkout.creatorUsername || checkout.creatorId,
        purchasedAt: new Date().toISOString(),
        purchaseId: sessionId,
        price: amount
      }
    }).promise();
    
    // Also create purchase record for history
    await dynamodb.put({
      TableName: 'Twilly',
      Item: {
        PK: `PURCHASE#${buyerEmail}`,
        SK: `ITEM#${normalizedVideoId}`,
        videoId: normalizedVideoId,
        clipId: checkout.clipId,
        title: checkout.title,
        creatorId: checkout.creatorId,
        creatorUsername: checkout.creatorUsername || checkout.creatorId,
        purchasedAt: new Date().toISOString(),
        purchaseId: sessionId,
        price: amount
      }
    }).promise();
    
    console.log(`✅ Unlocked content ${normalizedVideoId} for buyer ${buyerEmail}`);
  }
  
  // Process revenue split (15% platform, 85% creator - NO affiliate)
  await processContentPurchaseRevenue(checkout, amount, dynamodb, buyerEmail);
  
  // Update checkout status
  await dynamodb.update({
    TableName: 'Twilly',
    Key: {
      PK: `CHECKOUT#${sessionId}`,
      SK: 'DETAILS'
    },
    UpdateExpression: 'SET status = :status, processedAt = :processedAt, buyerEmail = :buyerEmail',
    ExpressionAttributeValues: {
      ':status': 'completed',
      ':processedAt': new Date().toISOString(),
      ':buyerEmail': buyerEmail || 'unknown'
    }
  }).promise();
  
  console.log('Content purchase processed successfully');
}

async function processContentPurchaseRevenue(checkout, amount, dynamodb, buyerEmail) {
  console.log('Processing content purchase revenue:', { amount, creatorId: checkout.creatorId });
  
  // NEW REVENUE SPLIT: 15% platform, 85% creator (NO affiliate)
  const platformFee = Math.round(amount * 0.15 * 100) / 100; // 15% platform fee
  const creatorShare = Math.round(amount * 0.85 * 100) / 100; // 85% to creator
  
  console.log('Revenue split calculation (15% platform, 85% creator):', {
    totalAmount: amount,
    platformFee,
    creatorShare
  });
  
  // Use the new ledger system to record the sale
  try {
    const ledgerResponse = await fetch(`${process.env.NODE_ENV === 'production' ? 'https://twilly.app' : 'http://localhost:3000'}/api/ledger/record-sale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        purchaseId: checkout.sessionId,
        buyerId: buyerEmail || checkout.buyerId || 'unknown',
        buyerEmail: buyerEmail || checkout.buyerEmail || 'unknown',
        creatorId: checkout.creatorId,
        creatorEmail: checkout.creatorId,
        contentId: checkout.clipId,
        contentTitle: checkout.title,
        amount: amount,
        platformFee: platformFee,
        creatorShare: creatorShare,
        // No affiliate fields (removed)
        channelName: checkout.channelName,
        paymentMethod: 'stripe'
      })
    });

    if (ledgerResponse.ok) {
      const ledgerResult = await ledgerResponse.json();
      console.log('Sale recorded in ledger:', ledgerResult);
    } else {
      console.error('Failed to record sale in ledger:', await ledgerResponse.text());
    }
  } catch (error) {
    console.error('Error recording sale in ledger:', error);
  }
  
  // Update creator earnings (legacy)
  await dynamodb.update({
    TableName: 'Twilly',
    Key: {
      PK: `USER#${checkout.creatorId}`,
      SK: 'EARNINGS#total'
    },
    UpdateExpression: 'ADD totalEarnings :amount SET lastUpdated = :timestamp',
    ExpressionAttributeValues: {
      ':amount': creatorShare,
      ':timestamp': new Date().toISOString()
    }
  }).promise();
  
  console.log(`Creator ${checkout.creatorId} earned $${creatorShare} (platform fee: $${platformFee})`);
} 