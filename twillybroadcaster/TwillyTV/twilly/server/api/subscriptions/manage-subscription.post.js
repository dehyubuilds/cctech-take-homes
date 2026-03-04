import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { 
      action, // 'subscribe', 'unsubscribe', 'check_status'
      subscriberId, 
      seriesId,
      lemonSqueezyOrderId = null,
      lemonSqueezySubscriptionId = null
    } = body;

    if (!action || !subscriberId || !seriesId) {
      return {
        success: false,
        message: 'Missing required fields: action, subscriberId, and seriesId are required'
      };
    }

    switch (action) {
      case 'subscribe':
        return await handleSubscribe(subscriberId, seriesId, lemonSqueezyOrderId, lemonSqueezySubscriptionId);
      
      case 'unsubscribe':
        return await handleUnsubscribe(subscriberId, seriesId);
      
      case 'check_status':
        return await checkSubscriptionStatus(subscriberId, seriesId);
      
      default:
        return {
          success: false,
          message: 'Invalid action. Must be subscribe, unsubscribe, or check_status'
        };
    }

  } catch (error) {
    console.error('Error managing subscription:', error);
    return {
      success: false,
      message: 'Failed to manage subscription',
      error: error.message
    };
  }
});

async function handleSubscribe(subscriberId, seriesId, orderId, subscriptionId) {
  try {
    // Get series information
    const seriesResponse = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `SERIES#${seriesId}`,
        SK: 'METADATA'
      }
    }).promise();

    if (!seriesResponse.Item) {
      return {
        success: false,
        message: 'Series not found'
      };
    }

    const series = seriesResponse.Item;

    // Create subscription record
    const subscriptionRecord = {
      PK: `SUBSCRIBER#${subscriberId}`,
      SK: `SUBSCRIPTION#${seriesId}`,
      subscriberId: subscriberId,
      seriesId: seriesId,
      seriesName: series.seriesName,
      subscriptionPrice: series.subscriptionPrice,
      lemonSqueezyOrderId: orderId,
      lemonSqueezySubscriptionId: subscriptionId,
      status: 'active',
      subscribedAt: new Date().toISOString(),
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      totalPaid: series.subscriptionPrice
    };

    // Create series subscriber record
    const seriesSubscriberRecord = {
      PK: `SERIES#${seriesId}`,
      SK: `SUBSCRIBER#${subscriberId}`,
      subscriberId: subscriberId,
      subscriberEmail: subscriberId, // Assuming subscriberId is email
      subscribedAt: new Date().toISOString(),
      status: 'active'
    };

    // Update series subscriber count
    const updateSeriesParams = {
      TableName: table,
      Key: {
        PK: `SERIES#${seriesId}`,
        SK: 'METADATA'
      },
      UpdateExpression: 'SET subscriberCount = subscriberCount + :inc, totalRevenue = totalRevenue + :price, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':price': series.subscriptionPrice,
        ':updatedAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    // Batch write subscription records
    await dynamodb.batchWrite({
      RequestItems: {
        [table]: [
          { PutRequest: { Item: subscriptionRecord } },
          { PutRequest: { Item: seriesSubscriberRecord } }
        ]
      }
    }).promise();

    // Update series metadata
    await dynamodb.update(updateSeriesParams).promise();

    console.log('Subscription created successfully:', subscriptionRecord);

    return {
      success: true,
      message: 'Successfully subscribed to series',
      data: {
        subscriptionId: `${subscriberId}_${seriesId}`,
        seriesName: series.seriesName,
        subscriptionPrice: series.subscriptionPrice,
        nextBillingDate: subscriptionRecord.nextBillingDate
      }
    };

  } catch (error) {
    console.error('Error handling subscription:', error);
    throw error;
  }
}

async function handleUnsubscribe(subscriberId, seriesId) {
  try {
    // Get subscription record
    const subscriptionResponse = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `SUBSCRIBER#${subscriberId}`,
        SK: `SUBSCRIPTION#${seriesId}`
      }
    }).promise();

    if (!subscriptionResponse.Item) {
      return {
        success: false,
        message: 'Subscription not found'
      };
    }

    const subscription = subscriptionResponse.Item;

    // Update subscription status
    const updateSubscriptionParams = {
      TableName: table,
      Key: {
        PK: `SUBSCRIBER#${subscriberId}`,
        SK: `SUBSCRIPTION#${seriesId}`
      },
      UpdateExpression: 'SET status = :status, unsubscribedAt = :unsubscribedAt',
      ExpressionAttributeValues: {
        ':status': 'cancelled',
        ':unsubscribedAt': new Date().toISOString()
      }
    };

    // Update series subscriber record
    const updateSeriesSubscriberParams = {
      TableName: table,
      Key: {
        PK: `SERIES#${seriesId}`,
        SK: `SUBSCRIBER#${subscriberId}`
      },
      UpdateExpression: 'SET status = :status, unsubscribedAt = :unsubscribedAt',
      ExpressionAttributeValues: {
        ':status': 'cancelled',
        ':unsubscribedAt': new Date().toISOString()
      }
    };

    // Update series subscriber count
    const updateSeriesParams = {
      TableName: table,
      Key: {
        PK: `SERIES#${seriesId}`,
        SK: 'METADATA'
      },
      UpdateExpression: 'SET subscriberCount = subscriberCount - :dec, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':dec': 1,
        ':updatedAt': new Date().toISOString()
      }
    };

    // Execute updates
    await Promise.all([
      dynamodb.update(updateSubscriptionParams).promise(),
      dynamodb.update(updateSeriesSubscriberParams).promise(),
      dynamodb.update(updateSeriesParams).promise()
    ]);

    console.log('Subscription cancelled successfully');

    return {
      success: true,
      message: 'Successfully unsubscribed from series',
      data: {
        seriesId: seriesId,
        unsubscribedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Error handling unsubscription:', error);
    throw error;
  }
}

async function checkSubscriptionStatus(subscriberId, seriesId) {
  try {
    // Get subscription record
    const subscriptionResponse = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `SUBSCRIBER#${subscriberId}`,
        SK: `SUBSCRIPTION#${seriesId}`
      }
    }).promise();

    if (!subscriptionResponse.Item) {
      return {
        success: true,
        data: {
          isSubscribed: false,
          subscription: null
        }
      };
    }

    const subscription = subscriptionResponse.Item;

    return {
      success: true,
      data: {
        isSubscribed: subscription.status === 'active',
        subscription: {
          id: `${subscriberId}_${seriesId}`,
          seriesId: seriesId,
          seriesName: subscription.seriesName,
          status: subscription.status,
          subscribedAt: subscription.subscribedAt,
          nextBillingDate: subscription.nextBillingDate,
          totalPaid: subscription.totalPaid
        }
      }
    };

  } catch (error) {
    console.error('Error checking subscription status:', error);
    throw error;
  }
} 