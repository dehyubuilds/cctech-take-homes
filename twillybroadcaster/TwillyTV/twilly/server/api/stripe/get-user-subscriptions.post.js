import AWS from 'aws-sdk';

export default defineEventHandler(async (event) => {
  console.log('=== GET USER SUBSCRIPTIONS API CALLED ===');
  
  // Configure AWS with hardcoded credentials
  AWS.config.update({
    region: 'us-east-1',
    accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
    secretAccessKey: '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'
  });

  const dynamodb = new AWS.DynamoDB.DocumentClient();

  try {
    const body = await readBody(event);
    const { subscriberId } = body;

    if (!subscriberId) {
      return {
        success: false,
        message: 'Subscriber ID is required'
      };
    }

    console.log('Getting subscriptions for subscriber:', subscriberId);

    // Test DynamoDB connectivity first
    try {
      const testResult = await dynamodb.scan({
        TableName: 'Twilly',
        Limit: 1
      }).promise();
      console.log('DynamoDB connectivity test - Items count:', testResult.Items ? testResult.Items.length : 0);
    } catch (error) {
      console.error('DynamoDB connectivity test failed:', error);
      return {
        success: false,
        message: 'DynamoDB connectivity failed',
        error: error.message
      };
    }

    // Query DynamoDB for user's subscriptions using the SUBSCRIBER pattern
    const params = {
      TableName: 'Twilly',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `SUBSCRIBER#${subscriberId}`
      }
    };

    console.log('DynamoDB query params:', JSON.stringify(params, null, 2));

    try {
      const result = await dynamodb.query(params).promise();
      
      console.log('DynamoDB query result - Items count:', result.Items ? result.Items.length : 0);
      console.log('DynamoDB query result - Items:', result.Items);

      if (!result.Items || result.Items.length === 0) {
        console.log('No subscriptions found for subscriber:', subscriberId);
        return {
          success: true,
          subscriptions: []
        };
      }

      // Format the subscriptions and fetch amount from subscription records
      const subscriptions = await Promise.all(result.Items.map(async (item) => {
        // Get the subscription details to fetch the amount
        const subscriptionParams = {
          TableName: 'Twilly',
          Key: {
            PK: `SUBSCRIPTION#${item.subscriptionId}`,
            SK: 'DETAILS'
          }
        };

        // Get creator's email from username using the existing API
        let creatorEmail = '';
        let creatorUsername = item.creatorUsername;
        
        // If creatorUsername is undefined, extract it from channelId
        if (!creatorUsername && item.channelId) {
          creatorUsername = item.channelId.split('-')[0];
          console.log('Extracted creator username from channelId:', creatorUsername);
        }
        
        if (creatorUsername) {
          try {
            // Use the existing get-username API pattern
            const creatorParams = {
              TableName: 'Twilly',
              KeyConditionExpression: 'PK = :pk',
              FilterExpression: 'username = :username',
              ExpressionAttributeValues: {
                ':pk': 'USER',
                ':username': creatorUsername
              }
            };
            const creatorResult = await dynamodb.query(creatorParams).promise();
            if (creatorResult.Items && creatorResult.Items.length > 0) {
              creatorEmail = creatorResult.Items[0].email || '';
              console.log('Found creator email:', creatorEmail);
            }
          } catch (error) {
            console.error('Error fetching creator email from username:', error);
          }
        }
        
        // Get the actual poster URL from the folder data
        let posterUrl = '';
        console.log('Looking up poster URL for:', { creatorEmail, channelName: item.channelName });
        
        if (creatorEmail && item.channelName) {
          try {
            // Query for the folder to get the actual seriesPosterUrl
            const folderParams = {
              TableName: 'Twilly',
              KeyConditionExpression: 'PK = :pk',
              FilterExpression: '#n = :name',
              ExpressionAttributeNames: {
                '#n': 'name'
              },
              ExpressionAttributeValues: {
                ':pk': `USER#${creatorEmail}`,
                ':name': item.channelName
              }
            };
            console.log('Folder query params:', JSON.stringify(folderParams, null, 2));
            
            const folderResult = await dynamodb.query(folderParams).promise();
            console.log('Folder query result - Items count:', folderResult.Items ? folderResult.Items.length : 0);
            console.log('Folder query result - Items:', folderResult.Items);
            
            if (folderResult.Items && folderResult.Items.length > 0) {
              const folder = folderResult.Items[0];
              console.log('Found folder:', folder);
              console.log('Folder seriesPosterUrl:', folder.seriesPosterUrl);
              
              if (folder.seriesPosterUrl) {
                // Use the actual poster URL from the folder
                posterUrl = folder.seriesPosterUrl.replace('/series-posters/', '/public/series-posters/');
                console.log('Found actual poster URL:', posterUrl);
              } else {
                console.log('No seriesPosterUrl found in folder');
              }
            } else {
              console.log('No folder found for channel:', item.channelName);
            }
          } catch (error) {
            console.error('Error fetching folder poster URL:', error);
          }
        } else {
          console.log('Missing creatorEmail or channelName:', { creatorEmail, channelName: item.channelName });
        }
        
        // Fallback to default poster URL if no actual poster found
        if (!posterUrl) {
          posterUrl = `https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/${creatorEmail}/${encodeURIComponent(item.channelName)}/DsinyanGivzey.jpeg`;
          console.log('Using fallback poster URL:', posterUrl);
        }

        try {
          const subscriptionResult = await dynamodb.get(subscriptionParams).promise();
          const subscription = subscriptionResult.Item;
          
          // If subscription is pending, check Stripe for payment confirmation
          let finalStatus = item.status;
          if (item.status === 'pending' && item.subscriptionId) {
            console.log('Checking pending subscription:', item.subscriptionId);
            try {
              const Stripe = (await import('stripe')).default;
              const stripe = new Stripe('sk_test_51OXsV0HCxgj7mB8yEfuPrnyAZMRhoC9MQgr8bSp8g9yNvQ13Coro68YDfIqKIDCUYg2Wnp17xrvEU6E5UPcgcrz500Er5Mpfz0');
              const session = await stripe.checkout.sessions.retrieve(item.subscriptionId);
              console.log('Stripe session status:', session.payment_status, session.status);

              if (session.payment_status === 'paid' && session.status === 'complete') {
                console.log('Payment confirmed from Stripe, updating status to active');
                // Update the subscription status in DynamoDB
                await dynamodb.update({
                  TableName: 'Twilly',
                  Key: {
                    PK: `SUBSCRIBER#${subscriberId}`,
                    SK: `CHANNEL#${item.channelId}`
                  },
                  UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
                  ExpressionAttributeNames: {
                    '#status': 'status'
                  },
                  ExpressionAttributeValues: {
                    ':status': 'active',
                    ':updatedAt': new Date().toISOString()
                  }
                }).promise();

                finalStatus = 'active';
                console.log('✅ Subscription status updated to active');
              }
            } catch (error) {
              console.error('Error checking Stripe session:', error);
            }
          }
          
          return {
            id: item.subscriptionId,
            channelId: item.channelId,
            channelName: item.channelName,
            creatorUsername: item.creatorUsername,
            amount: subscription ? subscription.amount : null,
            status: finalStatus,
            createdAt: item.subscribedAt,
            nextBillingDate: item.subscribedAt, // For now, use subscribedAt as nextBillingDate
            posterUrl: posterUrl
          };
        } catch (error) {
          console.error('Error fetching subscription details:', error);
          return {
            id: item.subscriptionId,
            channelId: item.channelId,
            channelName: item.channelName,
            creatorUsername: item.creatorUsername,
            amount: null,
            status: item.status,
            createdAt: item.subscribedAt,
            nextBillingDate: item.subscribedAt,
            posterUrl: posterUrl
          };
        }
      }));

      console.log('Found subscriptions:', subscriptions.length);
      console.log('Subscription statuses:', subscriptions.map(s => ({ 
        channelName: s.channelName, 
        status: s.status,
        creatorUsername: s.creatorUsername 
      })));
      
      return {
        success: true,
        subscriptions: subscriptions,
        totalCount: subscriptions.length,
        activeCount: subscriptions.filter(s => s.status === 'active').length,
        pendingCount: subscriptions.filter(s => s.status === 'pending').length,
        cancelledCount: subscriptions.filter(s => s.status === 'cancelled').length
      };

    } catch (error) {
      console.error('DynamoDB query error:', error);
      return {
        success: false,
        message: 'Failed to get user subscriptions',
        error: error.message
      };
    }

    if (!result.Items || result.Items.length === 0) {
      console.log('No subscriptions found for subscriber:', subscriberId);
      return {
        success: true,
        subscriptions: []
      };
    }

    // Format the subscriptions
    const subscriptions = result.Items.map(item => ({
      id: item.subscriptionId,
      channelId: item.channelId,
      channelName: item.channelName,
      creatorUsername: item.creatorUsername,
      amount: item.amount,
      status: item.status,
      createdAt: item.createdAt,
      nextBillingDate: item.nextBillingDate
    }));

    console.log('Found subscriptions:', subscriptions.length);

    return {
      success: true,
      subscriptions: subscriptions
    };

  } catch (error) {
    console.error('Error getting user subscriptions:', error);
    return {
      success: false,
      message: 'Failed to get user subscriptions',
      error: error.message
    };
  }
}); 