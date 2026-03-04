const AWS = require('aws-sdk');
const stripe = require('stripe')('sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0');

// Configure AWS with hardcoded credentials
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
    const { subscriptionId, channelId, amount, subscriberId } = body;
    
    if (!subscriptionId || !channelId || !amount || !subscriberId) {
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
          message: 'Missing required fields: subscriptionId, channelId, amount, subscriberId'
        })
      };
    }
    
    console.log('Processing enhanced subscription payment:', { subscriptionId, channelId, amount, subscriberId });
    
    // Get channel owner information
    const channelOwnerResult = await dynamodb.get({
      TableName: tableName,
      Key: {
        PK: `CHANNEL#${channelId}`,
        SK: 'OWNER'
      }
    }).promise();
    
    if (!channelOwnerResult.Item) {
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
          message: 'Channel owner not found'
        })
      };
    }
    
    const channelOwner = channelOwnerResult.Item;
    
    // Get channel owner's Stripe Connect account
    const ownerStripeResult = await dynamodb.get({
      TableName: tableName,
      Key: {
        PK: `USER#${channelOwner.userId}`,
        SK: 'STRIPE_CONNECT'
      }
    }).promise();
    
    if (!ownerStripeResult.Item || ownerStripeResult.Item.status !== 'connected') {
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
          message: 'Channel owner does not have active payout account'
        })
      };
    }

    // 🆕 NEW: Calculate revenue attribution using ledger-based system
    console.log('💰 Calculating revenue attribution...');
    const paymentPeriod = new Date().toISOString();
    
    try {
      // Call the revenue attribution API
      const attributionResponse = await fetch('http://localhost:3001/api/ledger/calculate-revenue-attribution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channelId: channelId,
          totalRevenue: amount,
          paymentPeriod: paymentPeriod,
          preview: false // Create actual ledger entry
        })
      });

      if (!attributionResponse.ok) {
        console.error('❌ Revenue attribution calculation failed, falling back to default split');
        throw new Error('Revenue attribution calculation failed');
      }

      const attributionData = await attributionResponse.json();
      console.log('✅ Revenue attribution calculated:', attributionData);

      // Use the calculated revenue split
      const revenueSplit = attributionData.data.revenueSplit;
      
      // Calculate platform fee (10%)
      const platformFee = Math.round(amount * 0.10);
      
      // Transfer funds to contributors based on ledger calculation
      const transfers = await processRevenueTransfers(
        revenueSplit, 
        channelOwner, 
        ownerStripeResult.Item, 
        subscriptionId, 
        channelId
      );

      // Store enhanced subscription record with attribution data
      const subscriptionRecord = {
        PK: `SUBSCRIPTION#${subscriptionId}`,
        SK: 'DETAILS',
        subscriptionId,
        channelId,
        subscriberId,
        amount,
        platformFee,
        attributionLedgerId: attributionData.data.attributionLedgerId,
        episodeContributions: attributionData.data.episodeContributions,
        calculationMethod: 'ledger_based_attribution',
        revenueSplit: revenueSplit,
        transfers: transfers,
        processedAt: new Date().toISOString(),
        status: 'completed'
      };
      
      await dynamodb.put({
        TableName: tableName,
        Item: subscriptionRecord
      }).promise();
      
      console.log('✅ Enhanced subscription payment processed successfully');
      
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
          message: 'Enhanced subscription payment processed successfully',
          subscriptionId,
          platformFee,
          attributionLedgerId: attributionData.data.attributionLedgerId,
          episodeContributions: attributionData.data.episodeContributions,
          revenueSplit: revenueSplit,
          transfers: transfers.length
        })
      };

    } catch (attributionError) {
      console.error('❌ Revenue attribution failed, using fallback:', attributionError);
      
      // Fallback to original simple split
      return await processFallbackPayment(subscriptionId, channelId, amount, subscriberId, channelOwner, ownerStripeResult.Item);
    }
    
  } catch (error) {
    console.error('Error processing enhanced subscription payment:', error);
    
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
        message: 'Failed to process subscription payment',
        error: error.message
      })
    };
  }
};

/**
 * Process revenue transfers based on ledger-calculated attribution
 */
async function processRevenueTransfers(revenueSplit, channelOwner, ownerStripeAccount, subscriptionId, channelId) {
  const transfers = [];
  
  // Transfer to contributors based on their calculated shares
  for (const contributor of revenueSplit.contributorSplits) {
    try {
      // Get contributor's Stripe Connect account
      const contributorStripeResult = await dynamodb.get({
        TableName: tableName,
        Key: {
          PK: `USER#${contributor.userId}`,
          SK: 'STRIPE_CONNECT'
        }
      }).promise();
      
      if (contributorStripeResult.Item && contributorStripeResult.Item.status === 'connected') {
        const transfer = await stripe.transfers.create({
          amount: contributor.share,
          currency: 'usd',
          destination: contributorStripeResult.Item.stripeAccountId,
          description: `Revenue share for ${contributor.role} - ${channelId}`,
          metadata: {
            subscriptionId,
            channelId,
            contributorId: contributor.userId,
            contributorRole: contributor.role,
            episodeWeight: contributor.weight,
            percentage: contributor.percentage,
            type: 'ledger_based_attribution'
          }
        });
        
        transfers.push({
          contributorId: contributor.userId,
          contributorRole: contributor.role,
          transferId: transfer.id,
          amount: contributor.share,
          percentage: contributor.percentage,
          episodeWeight: contributor.weight
        });
        
        console.log(`✅ Transfer created for ${contributor.role} ${contributor.userId}: $${contributor.share}`);
      } else {
        console.log(`⚠️ Contributor ${contributor.userId} has no active payout account, skipping transfer`);
      }
    } catch (error) {
      console.error(`❌ Error transferring to contributor ${contributor.userId}:`, error);
    }
  }
  
  return transfers;
}

/**
 * Fallback to original simple revenue split if attribution fails
 */
async function processFallbackPayment(subscriptionId, channelId, amount, subscriberId, channelOwner, ownerStripeAccount) {
  console.log('🔄 Using fallback payment processing...');
  
  // Original simple split logic
  const platformFee = Math.round(amount * 0.10);
  const remainingAmount = amount - platformFee;
  const ownerShare = Math.round(remainingAmount * 0.70);
  const collaboratorShare = Math.round(remainingAmount * 0.15);
  const affiliateShare = remainingAmount - ownerShare - collaboratorShare;
  
  // Transfer to channel owner
  const ownerTransfer = await stripe.transfers.create({
    amount: ownerShare,
    currency: 'usd',
    destination: ownerStripeAccount.stripeAccountId,
    description: `Revenue share for channel ${channelId}`,
    metadata: {
      subscriptionId,
      channelId,
      type: 'owner_share_fallback'
    }
  });
  
  // Store fallback subscription record
  const subscriptionRecord = {
    PK: `SUBSCRIPTION#${subscriptionId}`,
    SK: 'DETAILS',
    subscriptionId,
    channelId,
    subscriberId,
    amount,
    platformFee,
    ownerShare,
    collaboratorShare,
    affiliateShare,
    ownerTransferId: ownerTransfer.id,
    calculationMethod: 'fallback_simple_split',
    processedAt: new Date().toISOString(),
    status: 'completed'
  };
  
  await dynamodb.put({
    TableName: tableName,
    Item: subscriptionRecord
  }).promise();
  
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
      message: 'Subscription payment processed successfully (fallback mode)',
      subscriptionId,
      platformFee,
      ownerShare,
      collaboratorShare,
      affiliateShare,
      ownerTransferId: ownerTransfer.id,
      calculationMethod: 'fallback_simple_split'
    })
  };
}
