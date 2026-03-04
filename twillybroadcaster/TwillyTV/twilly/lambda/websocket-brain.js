const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

// WebSocket connection management
const connections = new Map();
const subscriptions = new Map();
const messageHandlers = new Map();

// Initialize message handlers
const initializeMessageHandlers = () => {
  // Content handlers
  messageHandlers.set('content', handleContentMessage);
  messageHandlers.set('channels', handleChannelsMessage);
  messageHandlers.set('featured', handleFeaturedMessage);
  messageHandlers.set('live', handleLiveMessage);
  messageHandlers.set('episodes', handleEpisodesMessage);
  
  // Media handlers
  messageHandlers.set('fire', handleFireMessage);
  messageHandlers.set('status', handleStatusMessage);
  messageHandlers.set('ads', handleAdsMessage);
  messageHandlers.set('series', handleSeriesMessage);
  
  // System handlers
  messageHandlers.set('heartbeat', handleHeartbeatMessage);
  messageHandlers.set('subscribe', handleSubscribeMessage);
  messageHandlers.set('unsubscribe', handleUnsubscribeMessage);
  
  // Reaction handlers
  messageHandlers.set('reaction', handleReactionMessage);
  
  // Text handlers
  messageHandlers.set('text', handleTextMessage);
};

// Main handler
exports.handler = async (event, context) => {
  console.log('🧠 WebSocket Brain received event:', JSON.stringify(event, null, 2));
  
  try {
    // Initialize message handlers
    initializeMessageHandlers();
    
    const { routeKey, connectionId, body } = event;
    
    // Store connection
    if (connectionId) {
      connections.set(connectionId, {
        id: connectionId,
        connectedAt: new Date().toISOString(),
        lastActivity: Date.now(),
        subscriptions: new Set()
      });
    }
    
    switch (routeKey) {
      case '$connect':
        return handleConnect(connectionId);
        
      case '$disconnect':
        return handleDisconnect(connectionId);
        
      case '$default':
        return handleDefault(connectionId, body);
        
      default:
        return handleCustomRoute(routeKey, connectionId, body);
    }
    
  } catch (error) {
    console.error('Error in WebSocket Brain:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

// Handle WebSocket connection
const handleConnect = async (connectionId) => {
  console.log('🔌 New WebSocket connection:', connectionId);
  
  // Send welcome message
  await sendMessage(connectionId, {
    type: 'system',
    message: 'Welcome to Twilly WebSocket Brain',
    connectionId,
    timestamp: new Date().toISOString()
  });
  
  return { statusCode: 200 };
};

// Handle WebSocket disconnection
const handleDisconnect = async (connectionId) => {
  console.log('🔌 WebSocket disconnected:', connectionId);
  
  // Clean up connection
  if (connections.has(connectionId)) {
    const connection = connections.get(connectionId);
    
    // Remove from all subscriptions
    connection.subscriptions.forEach(subType => {
      if (subscriptions.has(subType)) {
        subscriptions.get(subType).delete(connectionId);
      }
    });
    
    connections.delete(connectionId);
  }
  
  return { statusCode: 200 };
};

// Handle default route (message handling)
const handleDefault = async (connectionId, body) => {
  if (!body) {
    return { statusCode: 400, body: 'No message body' };
  }
  
  try {
    const message = JSON.parse(body);
    console.log('📨 Received message:', message);
    
    // Update last activity
    if (connections.has(connectionId)) {
      connections.get(connectionId).lastActivity = Date.now();
    }
    
    // Route message to appropriate handler
    const result = await routeMessage(connectionId, message);
    
    return { statusCode: 200, body: JSON.stringify(result) };
    
  } catch (error) {
    console.error('Error handling message:', error);
    return { statusCode: 400, body: 'Invalid message format' };
  }
};

// Handle custom routes
const handleCustomRoute = async (routeKey, connectionId, body) => {
  console.log('🛣️ Custom route:', routeKey);
  
  // Handle specific routes if needed
  switch (routeKey) {
    case 'subscribe':
      return await handleSubscribeMessage(connectionId, body);
      
    case 'text':
      return await handleTextMessage(connectionId, body);
      
    case 'fire':
      return await handleFireMessage(connectionId, body);
      
    case 'status':
      return await handleStatusMessage(connectionId, body);
      
    default:
      return { statusCode: 404, body: 'Route not found' };
  }
};

// Route message to appropriate handler
const routeMessage = async (connectionId, message) => {
  const { route, targetType } = message; // Changed from 'type' to 'route'
  
  // Find handler
  const handlerKey = targetType || route; // Changed from 'type' to 'route'
  const handler = messageHandlers.get(handlerKey);
  
  if (handler) {
    return await handler(connectionId, message);
  } else {
    console.warn('No handler found for message route:', handlerKey);
    return { success: false, message: 'No handler found' };
  }
};

// Message handlers
const handleContentMessage = async (connectionId, message) => {
  console.log('📺 Handling content message:', message);
  
  // Get content from DynamoDB
  const content = await getContentFromDynamoDB(message);
  
  // Send content back to the requesting connection
  await sendMessage(connectionId, {
    type: 'content',
    targetType: message.targetType,
    data: content,
    timestamp: new Date().toISOString()
  });
  
  return { success: true, message: 'Content sent' };
};

const handleChannelsMessage = async (connectionId, message) => {
  console.log('📡 Handling channels message:', message);
  
  try {
    // Get channels from DynamoDB
    const channels = await getChannelsFromDynamoDB();
    
    await sendMessage(connectionId, {
      type: 'channels',
      data: channels,
      timestamp: new Date().toISOString()
    });
    
    return { success: true, message: 'Channels sent' };
  } catch (error) {
    console.error('Error getting channels:', error);
    return { success: false, error: error.message };
  }
};

const handleFeaturedMessage = async (connectionId, message) => {
  console.log('⭐ Handling featured message:', message);
  
  try {
    const featured = await getFeaturedContentFromDynamoDB();
    
    await sendMessage(connectionId, {
      type: 'featured',
      data: featured,
      timestamp: new Date().toISOString()
    });
    
    return { success: true, message: 'Featured content sent' };
  } catch (error) {
    console.error('Error getting featured content:', error);
    return { success: false, error: error.message };
  }
};

const handleLiveMessage = async (connectionId, message) => {
  console.log('🔴 Handling live message:', message);
  
  try {
    const liveStreams = await getLiveStreamsFromDynamoDB();
    
    await sendMessage(connectionId, {
      type: 'live',
      data: liveStreams,
      timestamp: new Date().toISOString()
    });
    
    return { success: true, message: 'Live streams sent' };
  } catch (error) {
    console.error('Error getting live streams:', error);
    return { success: false, error: error.message };
  }
};

const handleEpisodesMessage = async (connectionId, message) => {
  console.log('📺 Handling episodes message:', message);
  
  try {
    const episodes = await getRecentEpisodesFromDynamoDB();
    
    await sendMessage(connectionId, {
      type: 'episodes',
      data: episodes,
      timestamp: new Date().toISOString()
    });
    
    return { success: true, message: 'Episodes sent' };
  } catch (error) {
    console.error('Error getting episodes:', error);
    return { success: false, error: error.message };
  }
};

const handleFireMessage = async (connectionId, message) => {
  console.log('🔥 Handling fire message:', message);
  
  // Broadcast fire reaction to all subscribers
  await broadcastToSubscribers('fire', {
    type: 'fire',
    content: '🔥',
    from: connectionId,
    timestamp: new Date().toISOString()
  });
  
  return { success: true, message: 'Fire broadcasted' };
};

const handleStatusMessage = async (connectionId, message) => {
  console.log('📊 Handling status message:', message);
  
  // Update user status
  await updateUserStatus(connectionId, message.content);
  
  // Broadcast status to all subscribers
  await broadcastToSubscribers('status', {
    type: 'status',
    content: message.content,
    from: connectionId,
    timestamp: new Date().toISOString()
  });
  
  return { success: true, message: 'Status updated' };
};

const handleAdsMessage = async (connectionId, message) => {
  console.log('📢 Handling ads message:', message);
  
  try {
    const ads = await getAdsFromDynamoDB();
    
    await sendMessage(connectionId, {
      type: 'ads',
      data: ads,
      timestamp: new Date().toISOString()
    });
    
    return { success: true, message: 'Ads sent' };
  } catch (error) {
    console.error('Error getting ads:', error);
    return { success: false, error: error.message };
  }
};

const handleSeriesMessage = async (connectionId, message) => {
  console.log('📚 Handling series message:', message);
  
  try {
    const series = await getSeriesFromDynamoDB();
    
    await sendMessage(connectionId, {
      type: 'series',
      data: series,
      timestamp: new Date().toISOString()
    });
    
    return { success: true, message: 'Series sent' };
  } catch (error) {
    console.error('Error getting series:', error);
    return { success: false, error: error.message };
  }
};

const handleHeartbeatMessage = async (connectionId, message) => {
  console.log('💓 Handling heartbeat from:', connectionId);
  
  // Update connection activity
  if (connections.has(connectionId)) {
    connections.get(connectionId).lastActivity = Date.now();
  }
  
  // Send heartbeat response
  await sendMessage(connectionId, {
    type: 'heartbeat',
    timestamp: Date.now()
  });
  
  return { success: true, message: 'Heartbeat received' };
};

const handleSubscribeMessage = async (connectionId, message) => {
  console.log('🔔 Handling subscription:', message);
  
  const { targetType } = message;
  
  if (!targetType) {
    return { success: false, message: 'No target type specified' };
  }
  
  // Add to subscriptions
  if (!subscriptions.has(targetType)) {
    subscriptions.set(targetType, new Set());
  }
  
  subscriptions.get(targetType).add(connectionId);
  
  // Update connection subscriptions
  if (connections.has(connectionId)) {
    connections.get(connectionId).subscriptions.add(targetType);
  }
  
  // Send subscription confirmation
  await sendMessage(connectionId, {
    type: 'subscription',
    targetType,
    message: 'Subscription updated',
    timestamp: new Date().toISOString()
  });
  
  return { success: true, message: 'Subscribed' };
};

const handleUnsubscribeMessage = async (connectionId, message) => {
  console.log('🔕 Handling unsubscription:', message);
  
  const { targetType } = message;
  
  if (!targetType) {
    return { success: false, message: 'No target type specified' };
  }
  
  // Remove from subscriptions
  if (subscriptions.has(targetType)) {
    subscriptions.get(targetType).delete(connectionId);
  }
  
  // Update connection subscriptions
  if (connections.has(connectionId)) {
    connections.get(connectionId).subscriptions.delete(targetType);
  }
  
  // Send unsubscription confirmation
  await sendMessage(connectionId, {
    type: 'subscription',
    targetType,
    message: 'Unsubscribed',
    timestamp: new Date().toISOString()
  });
  
  return { success: true, message: 'Unsubscribed' };
};

const handleReactionMessage = async (connectionId, message) => {
  console.log('😀 Handling reaction:', message);
  
  const { emoji } = message;
  
  // Broadcast reaction to all subscribers
  await broadcastToSubscribers('reactions', {
    type: 'reaction',
    emoji,
    from: connectionId,
    timestamp: new Date().toISOString()
  });
  
  return { success: true, message: 'Reaction broadcasted' };
};

const handleTextMessage = async (connectionId, message) => {
  console.log('💬 Handling text message:', message);
  
  const { content, targetType = 'defaultType' } = message;
  
  // Broadcast text message to all subscribers of the target type
  await broadcastToSubscribers(targetType, {
    type: 'text',
    content,
    from: connectionId,
    timestamp: new Date().toISOString()
  });
  
  return { success: true, message: 'Text message broadcasted' };
};

// DynamoDB functions
const getChannelsFromDynamoDB = async () => {
  const scanParams = {
    TableName: table,
    FilterExpression: 'begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':skPrefix': 'FOLDER#'
    }
  };
  
  const result = await dynamodb.scan(scanParams).promise();
  
  return (result.Items || [])
    .filter(item => item.SK && item.SK.startsWith('FOLDER#'))
    .map(item => {
      const channelName = item.SK.split('#').pop();
      return {
        id: item.SK,
        name: channelName,
        creatorUsername: item.creatorId || item.ownerEmail || 'unknown',
        description: item.description || `Premium content from ${channelName}`,
        category: item.category || 'Mixed',
        posterUrl: item.seriesPosterUrl || null,
        episodeCount: item.episodeCount || 0,
        isActive: item.isActive !== false
      };
    });
};

const getFeaturedContentFromDynamoDB = async () => {
  const scanParams = {
    TableName: table,
    FilterExpression: 'isVisible = :isVisible AND (begins_with(SK, :skPrefix) OR begins_with(SK, :skPrefix2))',
    ExpressionAttributeValues: {
      ':isVisible': true,
      ':skPrefix': 'FILE#',
      ':skPrefix2': 'EPISODE#'
    }
  };
  
  const result = await dynamodb.scan(scanParams).promise();
  
  return (result.Items || [])
    .filter(item => item.SK && (item.SK.startsWith('FILE#') || item.SK.startsWith('EPISODE#')))
    .slice(0, 20)
    .map(item => ({
      id: item.SK,
      title: item.title || item.fileName || 'Untitled',
      description: item.description || '',
      channelName: item.folderName || item.seriesName || 'Unknown Channel',
      creatorUsername: item.ownerEmail || item.creatorId || 'unknown',
      thumbnailUrl: item.thumbnailUrl || null,
      category: item.category || 'Mixed',
      duration: item.duration || null
    }));
};

const getLiveStreamsFromDynamoDB = async () => {
  // For now, return mock live streams
  // In production, you'd query your live stream table
  return [
    {
      id: 'live_1',
      title: 'Twilly After Dark - Live Session',
      channelName: 'Twilly After Dark',
      viewers: Math.floor(Math.random() * 100) + 10,
      duration: '2:34:12',
      isLive: true
    },
    {
      id: 'live_2',
      title: 'Twilly Fit - Morning Workout',
      channelName: 'Twilly Fit',
      viewers: Math.floor(Math.random() * 50) + 5,
      duration: '1:15:30',
      isLive: true
    }
  ];
};

const getRecentEpisodesFromDynamoDB = async () => {
  const scanParams = {
    TableName: table,
    FilterExpression: 'isVisible = :isVisible AND (begins_with(SK, :skPrefix) OR begins_with(SK, :skPrefix2))',
    ExpressionAttributeValues: {
      ':isVisible': true,
      ':skPrefix': 'FILE#',
      ':skPrefix2': 'EPISODE#'
    }
  };
  
  const result = await dynamodb.scan(scanParams).promise();
  
  return (result.Items || [])
    .filter(item => item.SK && (item.SK.startsWith('FILE#') || item.SK.startsWith('EPISODE#')))
    .sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp))
    .slice(0, 20)
    .map(item => ({
      id: item.SK,
      title: item.title || item.fileName || 'Untitled',
      description: item.description || '',
      channelName: item.folderName || item.seriesName || 'Unknown Channel',
      creatorUsername: item.ownerEmail || item.creatorId || 'unknown',
      thumbnailUrl: item.thumbnailUrl || null,
      category: item.category || 'Mixed',
      duration: item.duration || null
    }));
};

const getAdsFromDynamoDB = async () => {
  // Mock ads data - replace with actual DynamoDB query
  return [
    {
      id: 'ad_1',
      title: 'Premium Subscription',
      content: 'Get unlimited access to all channels',
      imageUrl: 'https://example.com/ad1.jpg'
    }
  ];
};

const getSeriesFromDynamoDB = async () => {
  // Mock series data - replace with actual DynamoDB query
  return [
    {
      id: 'series_1',
      title: 'Twilly After Dark',
      description: 'Late night entertainment',
      episodeCount: 25
    }
  ];
};

const getContentFromDynamoDB = async (message) => {
  // Generic content handler
  const { contentType } = message;
  
  switch (contentType) {
    case 'channels':
      return await getChannelsFromDynamoDB();
    case 'featured':
      return await getFeaturedContentFromDynamoDB();
    case 'live':
      return await getLiveStreamsFromDynamoDB();
    case 'episodes':
      return await getRecentEpisodesFromDynamoDB();
    default:
      return [];
  }
};

// Utility functions
const sendMessage = async (connectionId, message) => {
  // This would use the AWS API Gateway Management API to send messages
  // For now, just log the message
  console.log(`📤 Sending to ${connectionId}:`, message);
  
  // In production, you'd use:
  // const apiGateway = new AWS.ApiGatewayManagementApi({
  //   endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`
  // });
  // await apiGateway.postToConnection({
  //   ConnectionId: connectionId,
  //   Data: JSON.stringify(message)
  // }).promise();
};

const broadcastToSubscribers = async (targetType, message) => {
  if (!subscriptions.has(targetType)) return;
  
  const subscribers = subscriptions.get(targetType);
  
  for (const connectionId of subscribers) {
    try {
      await sendMessage(connectionId, message);
    } catch (error) {
      console.error(`Error broadcasting to ${connectionId}:`, error);
    }
  }
};

const updateUserStatus = async (connectionId, status) => {
  // Update user status in DynamoDB if needed
  console.log(`Updating status for ${connectionId}: ${status}`);
};

// Export for testing
module.exports = {
  handler: exports.handler,
  connections,
  subscriptions,
  messageHandlers
};
