import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { clipId, creatorId, price, title, description, isExclusive } = body;

    if (!clipId || !creatorId || !price || !title) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: clipId, creatorId, price, title'
      });
    }

    // Get creator info
    const creatorResult = await dynamodb.get({
      TableName: table,
      Key: {
        PK: `CREATOR#${creatorId}`,
        SK: 'PROFILE'
      }
    }).promise();

    if (!creatorResult.Item) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Creator not found'
      });
    }

    const creator = creatorResult.Item;

    // Generate Stripe product ID
    const productId = `stripe_product_${generateRandomString(16)}`;

    // Check if this is from a shared channel
    const streamKeyResult = await dynamodb.query({
      TableName: table,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `STREAM_KEY#${clipId.split('_')[0]}` // Extract stream key from clip ID
      }
    }).promise();

    const streamKeyMapping = streamKeyResult.Items?.[0];
    const isSharedChannel = streamKeyMapping?.isTemporary;
    const channelOwner = streamKeyMapping?.channelOwner;
    const guestStreamer = streamKeyMapping?.guestStreamer;

    // Calculate revenue split for shared channels
    let revenueSplit = {
      streamer: creator.revenueShare || 0.8,
      channelOwner: 0,
      platform: 0.2
    };

    if (isSharedChannel && channelOwner !== creatorId) {
      // Shared channel revenue split
      revenueSplit = {
        streamer: 0.7,      // 70% to actual streamer
        channelOwner: 0.1,  // 10% to channel owner
        platform: 0.2       // 20% to platform
      };
    }

    // Create monetized clip record
    const clipRecord = {
      PK: `CLIP#${clipId}`,
      SK: 'MONETIZATION',
      creatorId: creatorId,
      creatorEmail: creator.email,
      title: title,
      description: description || '',
      price: parseFloat(price),
      isExclusive: isExclusive || false,
      lemonSqueezyProductId: productId,
      lemonSqueezyStoreId: creator.lemonSqueezyStoreId,
      revenueShare: revenueSplit.streamer,
      isSharedChannel: isSharedChannel || false,
      channelOwner: channelOwner,
      guestStreamer: guestStreamer,
      revenueSplit: revenueSplit,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store the monetized clip
    await dynamodb.put({
      TableName: table,
      Item: clipRecord
    }).promise();

    // Create Lemon Squeezy product (this would integrate with Lemon Squeezy API)
    // For now, we'll simulate the product creation
    const lemonSqueezyProduct = {
      productId: productId,
      storeId: creator.lemonSqueezyStoreId,
      name: title,
      description: description || '',
      price: parseFloat(price) * 100, // Lemon Squeezy uses cents
      status: 'active'
    };

    return {
      success: true,
      clipId: clipId,
      productId: productId,
      creatorId: creatorId,
      price: price,
      revenueShare: creator.revenueShare || 0.8,
      message: 'Clip monetized successfully'
    };

  } catch (error) {
    console.error('Error monetizing clip:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to monetize clip'
    });
  }
});

function generateRandomString(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
} 