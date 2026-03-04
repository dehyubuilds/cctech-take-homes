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
      creatorId, 
      seriesName, 
      description, 
      subscriptionPrice, 
      revenueShares,
      thumbnailUrl,
      category = 'general'
    } = body;

    if (!creatorId || !seriesName || !subscriptionPrice) {
      return {
        success: false,
        message: 'Missing required fields: creatorId, seriesName, and subscriptionPrice are required'
      };
    }

    // Validate revenue shares
    const totalShare = revenueShares.reduce((sum, share) => sum + share.percentage, 0);
    if (totalShare !== 100) {
      return {
        success: false,
        message: 'Revenue shares must total 100%'
      };
    }

    // Generate unique series ID
    const seriesId = `series_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const config = useRuntimeConfig();
    
    // Create Lemon Squeezy subscription product
    console.log('Creating Lemon Squeezy subscription product:', {
      name: `${seriesName} - Subscription`,
      price: Math.round(subscriptionPrice * 100),
      storeId: config.lemonSqueezyStoreId
    });

    // Create product via Lemon Squeezy API
    const productResponse = await $fetch('https://api.lemonsqueezy.com/v1/products', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.lemonSqueezyApiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: {
        data: {
          type: 'products',
          attributes: {
            name: `${seriesName} - Subscription`,
            description: description || `Subscribe to ${seriesName} for exclusive content`,
            status: 'published',
            store_id: parseInt(config.lemonSqueezyStoreId)
          }
        }
      }
    });

    console.log('Subscription product created:', productResponse);

    // Create subscription variant
    const variantResponse = await $fetch('https://api.lemonsqueezy.com/v1/variants', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.lemonSqueezyApiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: {
        data: {
          type: 'variants',
          attributes: {
            name: `${seriesName} - Subscription`,
            price: Math.round(subscriptionPrice * 100), // Convert to cents
            status: 'published',
            product_id: productResponse.data.id,
            // Subscription settings
            subscription_interval: 'month',
            subscription_interval_count: 1,
            has_digital_delivery: true,
            has_physical_delivery: false
          }
        }
      }
    });

    console.log('Subscription variant created:', variantResponse);

    const productId = productResponse.data.id;
    const variantId = variantResponse.data.id;
    
    // Store series data in DynamoDB
    const seriesRecord = {
      PK: `SERIES#${seriesId}`,
      SK: 'METADATA',
      seriesId: seriesId,
      creatorId: creatorId,
      seriesName: seriesName,
      description: description,
      subscriptionPrice: subscriptionPrice,
      revenueShares: revenueShares,
      thumbnailUrl: thumbnailUrl,
      category: category,
      lemonSqueezyProductId: mockProductId,
      lemonSqueezyVariantId: mockVariantId,
      status: 'active',
      subscriberCount: 0,
      totalRevenue: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store creator's series reference
    const creatorSeriesRecord = {
      PK: `CREATOR#${creatorId}`,
      SK: `SERIES#${seriesId}`,
      seriesId: seriesId,
      seriesName: seriesName,
      subscriptionPrice: subscriptionPrice,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    // Store revenue share records
    const revenueShareRecords = revenueShares.map(share => ({
      PK: `SERIES#${seriesId}`,
      SK: `REVENUE_SHARE#${share.participantId}`,
      participantId: share.participantId,
      participantType: share.participantType, // 'creator', 'collaborator', 'platform'
      percentage: share.percentage,
      participantEmail: share.participantEmail,
      createdAt: new Date().toISOString()
    }));

    // Batch write to DynamoDB
    const writeRequests = [
      { PutRequest: { Item: seriesRecord } },
      { PutRequest: { Item: creatorSeriesRecord } },
      ...revenueShareRecords.map(record => ({ PutRequest: { Item: record } }))
    ];

    // Split into batches of 25 (DynamoDB limit)
    const batches = [];
    for (let i = 0; i < writeRequests.length; i += 25) {
      batches.push(writeRequests.slice(i, i + 25));
    }

    for (const batch of batches) {
      await dynamodb.batchWrite({
        RequestItems: {
          [table]: batch
        }
      }).promise();
    }

    console.log('Series created successfully:', seriesRecord);

    return {
      success: true,
      message: 'Series created successfully',
      data: {
        seriesId: seriesId,
        lemonSqueezyProductId: mockProductId,
        checkoutUrl: `https://app.lemonsqueezy.com/checkout/buy/${mockVariantId}`,
        series: {
          id: seriesId,
          name: seriesName,
          subscriptionPrice: subscriptionPrice,
          revenueShares: revenueShares
        }
      }
    };

  } catch (error) {
    console.error('Error creating series:', error);
    return {
      success: false,
      message: 'Failed to create series',
      error: error.message
    };
  }
}); 