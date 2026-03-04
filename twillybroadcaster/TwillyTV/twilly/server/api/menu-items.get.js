export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { email, series } = query;

    console.log('API - Getting menu items:', { email, series });

    if (!email || !series) {
      throw createError({
        statusCode: 400,
        message: 'Email and series are required'
      });
    }

    // Get subscription price for the channel
    let subscriptionPrice = 9.99; // Default price
    console.log('API - About to fetch subscription price for:', { email, series });
    try {
      const priceResponse = await $fetch('/api/channels/get-subscription-price', {
        method: 'POST',
        body: {
          channelId: `${email}-${series}`,
          channelName: series,
          creatorUsername: email
        }
      });
      
      console.log('API - Price response:', priceResponse);
      
      if (priceResponse.success) {
        subscriptionPrice = priceResponse.price;
        console.log('API - Retrieved subscription price:', subscriptionPrice);
      } else {
        console.log('API - Price response not successful, using default');
      }
    } catch (priceError) {
      console.error('API - Error getting subscription price:', priceError);
      // Continue with default price
    }

    // Always call API Gateway endpoint (no AWS credentials needed for HTTP calls)
    console.log('API - Calling API Gateway for menu items');
    
    // Use the deployed API Gateway URL
    const apiGatewayUrl = process.env.API_GATEWAY_URL || 'https://26d9slass5.execute-api.us-east-1.amazonaws.com';
    
    const response = await fetch(`${apiGatewayUrl}/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        series
      })
    });

    if (!response.ok) {
      console.error('API Gateway error:', response.status, response.statusText);
      throw createError({
        statusCode: response.status,
        message: `API Gateway error: ${response.status}`
      });
    }

    const menuItems = await response.json();
    console.log('API - Received menu items from API Gateway:', menuItems);
    
    // Add subscription price to the response
    return {
      items: menuItems,
      subscriptionPrice: subscriptionPrice
    };
    
  } catch (error) {
    console.error('API - Unexpected error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Internal server error',
      details: error.details || error.stack
    });
  }
}); 