import AWS from 'aws-sdk';
import payoutCalculator from '../../services/payoutCalculator.js';

// Configure AWS SDK
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { 
      purchaseId, 
      buyerId, 
      buyerEmail, 
      creatorId, 
      creatorEmail, 
      contentId, 
      contentTitle, 
      amount, 
      affiliateCode,
      affiliateId,
      affiliateEmail,
      channelName,
      paymentMethod = 'stripe'
    } = body;

    if (!purchaseId || !buyerId || !creatorId || !contentId || !amount) {
      return {
        success: false,
        message: 'Missing required fields: purchaseId, buyerId, creatorId, contentId, and amount'
      };
    }

    const timestamp = new Date().toISOString();
    const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Calculate splits using centralized payout calculator (OnlyFans-style)
    const hasAffiliate = !!(affiliateCode && affiliateId);
    const payoutSplits = payoutCalculator.calculatePPVSplits(amount, hasAffiliate);
    
    const platformFee = payoutSplits.platformFee;
    const creatorShare = payoutSplits.creatorShare;
    const affiliateShare = payoutSplits.affiliateShare;
    const affiliateCommission = affiliateShare;

    // Create main ledger record
    const ledgerRecord = {
      PK: `LEDGER#${timestamp.split('T')[0]}`, // Daily partition
      SK: `SALE#${transactionId}`,
      transactionId: transactionId,
      purchaseId: purchaseId,
      type: 'sale',
      buyerId: buyerId,
      buyerEmail: buyerEmail,
      creatorId: creatorId,
      creatorEmail: creatorEmail,
      contentId: contentId,
      contentTitle: contentTitle,
      channelName: channelName,
      amount: amount,
      platformFee: platformFee,
      creatorShare: creatorShare,
      affiliateShare: affiliateShare,
      affiliateCode: affiliateCode,
      affiliateId: affiliateId,
      affiliateEmail: affiliateEmail,
      paymentMethod: paymentMethod,
      status: 'completed',
      createdAt: timestamp,
      processedAt: timestamp
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: ledgerRecord
    }).promise();

    // Create buyer purchase record
    const buyerRecord = {
      PK: `USER#${buyerEmail}`,
      SK: `PURCHASE#${purchaseId}`,
      purchaseId: purchaseId,
      transactionId: transactionId,
      contentId: contentId,
      contentTitle: contentTitle,
      creatorId: creatorId,
      creatorEmail: creatorEmail,
      channelName: channelName,
      amount: amount,
      status: 'completed',
      purchaseDate: timestamp,
      type: 'purchase'
    };

    await dynamodb.put({
      TableName: 'Twilly',
      Item: buyerRecord
    }).promise();

    // Update creator earnings (creator gets 80%)
    await dynamodb.update({
      TableName: 'Twilly',
      Key: {
        PK: `USER#${creatorEmail}`,
        SK: 'EARNINGS#total'
      },
      UpdateExpression: 'ADD totalEarnings :amount, pendingEarnings :amount SET lastUpdated = :timestamp',
      ExpressionAttributeValues: {
        ':amount': creatorShare,
        ':timestamp': timestamp
      }
    }).promise();

    // Update creator channel earnings
    if (channelName) {
      await dynamodb.update({
        TableName: 'Twilly',
        Key: {
          PK: `USER#${creatorEmail}`,
          SK: `CHANNEL_EARNINGS#${channelName}`
        },
        UpdateExpression: 'ADD totalEarnings :amount, pendingEarnings :amount SET lastUpdated = :timestamp, channelName = :channelName',
        ExpressionAttributeValues: {
          ':amount': creatorShare,
          ':timestamp': timestamp,
          ':channelName': channelName
        }
      }).promise();
    }

    // Update affiliate earnings if applicable
    if (affiliateCode && affiliateId && affiliateEmail) {
      await dynamodb.update({
        TableName: 'Twilly',
        Key: {
          PK: `USER#${affiliateEmail}`,
          SK: 'AFFILIATE#main'
        },
        UpdateExpression: 'ADD totalEarnings :amount, pendingEarnings :amount, totalReferrals :count SET lastUpdated = :timestamp',
        ExpressionAttributeValues: {
          ':amount': affiliateShare,
          ':count': 1,
          ':timestamp': timestamp
        }
      }).promise();

      // Create affiliate commission record
      const affiliateCommissionRecord = {
        PK: `USER#${affiliateEmail}`,
        SK: `COMMISSION#${transactionId}`,
        transactionId: transactionId,
        purchaseId: purchaseId,
        creatorId: creatorId,
        creatorEmail: creatorEmail,
        contentId: contentId,
        contentTitle: contentTitle,
        channelName: channelName,
        commissionAmount: affiliateShare,
        commissionRate: 0.05,
        saleAmount: amount,
        status: 'earned',
        earnedAt: timestamp,
        type: 'commission'
      };

      await dynamodb.put({
        TableName: 'Twilly',
        Item: affiliateCommissionRecord
      }).promise();
    }

    // Update platform earnings
    await dynamodb.update({
      TableName: 'Twilly',
      Key: {
        PK: 'PLATFORM',
        SK: 'EARNINGS#total'
      },
      UpdateExpression: 'ADD totalEarnings :amount SET lastUpdated = :timestamp',
      ExpressionAttributeValues: {
        ':amount': platformFee,
        ':timestamp': timestamp
      }
    }).promise();

    return {
      success: true,
      message: 'Sale recorded successfully',
      transactionId: transactionId,
      splits: {
        creator: creatorShare,
        affiliate: affiliateShare,
        platform: platformFee,
        total: amount
      }
    };

  } catch (error) {
    console.error('Error recording sale in ledger:', error);
    return {
      success: false,
      message: 'Failed to record sale',
      error: error.message
    };
  }
});
