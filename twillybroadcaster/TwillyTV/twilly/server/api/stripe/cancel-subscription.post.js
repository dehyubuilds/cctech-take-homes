import AWS from 'aws-sdk';

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
    const { subscriptionId, subscriberId } = body;

    if (!subscriptionId || !subscriberId) {
      return {
        success: false,
        message: 'Subscription ID and Subscriber ID are required'
      };
    }

    console.log('Cancelling subscription:', subscriptionId, 'for subscriber:', subscriberId);
    console.log('Request body:', body);

    // If subscriberId looks like a username (no @), look up the email
    let actualSubscriberId = subscriberId;
    if (!subscriberId.includes('@')) {
      console.log('SubscriberId looks like a username, looking up email...');
      
      // Look up the email associated with this username
      const userParams = {
        TableName: 'Twilly',
        FilterExpression: 'PK = :pk AND username = :username',
        ExpressionAttributeValues: {
          ':pk': 'USER',
          ':username': subscriberId
        }
      };

      const userResult = await dynamodb.scan(userParams).promise();
      
      if (userResult.Items && userResult.Items.length > 0) {
        actualSubscriberId = userResult.Items[0].email;
        console.log('Found email for username:', subscriberId, '->', actualSubscriberId);
      } else {
        console.log('No user found for username:', subscriberId);
        return {
          success: false,
          message: 'User not found'
        };
      }
    }

    // First, get the subscription details to find the channelId
    const subscriptionDetailsParams = {
      TableName: 'Twilly',
      Key: {
        PK: `SUBSCRIPTION#${subscriptionId}`,
        SK: 'DETAILS'
      }
    };

    const subscriptionDetailsResult = await dynamodb.get(subscriptionDetailsParams).promise();
    console.log('Subscription details lookup result:', subscriptionDetailsResult);

    if (!subscriptionDetailsResult.Item) {
      console.log('Subscription details not found for ID:', subscriptionId);
      return {
        success: false,
        message: 'Subscription not found'
      };
    }

    // Find the subscriber record that matches this subscription ID
    // Try both email and username variations
    const subscriberQueryParams = {
      TableName: 'Twilly',
      FilterExpression: 'begins_with(PK, :pk) AND subscriptionId = :subscriptionId',
      ExpressionAttributeValues: {
        ':pk': 'SUBSCRIBER#',
        ':subscriptionId': subscriptionId
      }
    };

    const subscriberQueryResult = await dynamodb.scan(subscriberQueryParams).promise();
    console.log('Subscriber query result:', subscriberQueryResult);

    if (!subscriberQueryResult.Items || subscriberQueryResult.Items.length === 0) {
      console.log('No subscriber record found for subscription:', subscriptionId);
      return {
        success: false,
        message: 'Subscription not found'
      };
    }

    // Find the record that matches the requested subscriber
    const subscriberRecord = subscriberQueryResult.Items.find(item => 
      item.subscriberId === actualSubscriberId || 
      item.subscriberEmail === actualSubscriberId ||
      item.PK === `SUBSCRIBER#${actualSubscriberId}`
    );

    if (!subscriberRecord) {
      console.log('No matching subscriber record found for:', actualSubscriberId);
      console.log('Available records:', subscriberQueryResult.Items.map(item => ({
        PK: item.PK,
        subscriberId: item.subscriberId,
        subscriberEmail: item.subscriberEmail
      })));
      return {
        success: false,
        message: 'Unauthorized to cancel this subscription'
      };
    }

    console.log('Found subscriber record:', subscriberRecord);

    // Update the subscription status to cancelled
    const updateParams = {
      TableName: 'Twilly',
      Key: {
        PK: `SUBSCRIBER#${actualSubscriberId}`,
        SK: subscriberRecord.SK
      },
      UpdateExpression: 'SET #status = :status, cancelledAt = :cancelledAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'cancelled',
        ':cancelledAt': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.update(updateParams).promise();

    console.log('Subscription cancelled successfully:', subscriptionId);

    return {
      success: true,
      message: 'Subscription cancelled successfully',
      subscription: result.Attributes
    };

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return {
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    };
  }
}); 