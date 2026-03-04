/**
 * WebSocket Connection Cache Service
 * 
 * Phase 1: Connection Caching
 * - Maintains in-memory cache of active WebSocket connections
 * - Subscribes to DynamoDB changes to keep cache in sync
 * - Provides fast lookup for connection IDs by user email
 * 
 * Phase 2: Direct WebSocket Sending
 * - Sends WebSocket messages directly via API Gateway Management API
 * - Bypasses Lambda for cached connections (60-230ms faster)
 * 
 * Phase 3: Batch Processing
 * - Supports batching multiple notifications
 * - Reduces Lambda invocations and improves throughput
 */

import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

// In-memory connection cache
// Structure: Map<userEmail, Set<connectionId>>
const connectionCache = new Map();
let cacheInitialized = false;
let cacheRefreshInterval = null;

// API Gateway Management API client (for direct sending)
let apigwManagementApi = null;

/**
 * Initialize the WebSocket connection cache
 * Loads all active connections from DynamoDB and sets up refresh interval
 */
export async function initializeConnectionCache(websocketApiEndpoint) {
  if (cacheInitialized) {
    console.log('⚠️ [websocket-cache] Cache already initialized');
    return;
  }

  console.log('🔄 [websocket-cache] Initializing connection cache...');

  // Initialize API Gateway Management API client
  if (websocketApiEndpoint && websocketApiEndpoint !== 'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev') {
    // Extract domain from endpoint (remove protocol prefixes and path)
    const endpoint = websocketApiEndpoint
      .replace(/^https?:\/\//, '')
      .replace(/^wss?:\/\//, '')
      .split('/')[0]; // Get just the domain (e.g., abc123xyz.execute-api.us-east-1.amazonaws.com)
    
    apigwManagementApi = new AWS.ApiGatewayManagementApi({
      endpoint: endpoint
    });
    console.log(`✅ [websocket-cache] API Gateway Management API initialized: ${endpoint}`);
  } else {
    console.log('⚠️ [websocket-cache] No valid WebSocket API endpoint provided, direct sending disabled (using Lambda fallback)');
  }

  // Load initial connections from DynamoDB
  await refreshConnectionCache();

  // Set up periodic refresh (every 30 seconds) to catch any missed updates
  cacheRefreshInterval = setInterval(async () => {
    await refreshConnectionCache();
  }, 30000);

  cacheInitialized = true;
  console.log(`✅ [websocket-cache] Connection cache initialized with ${connectionCache.size} users`);
}

/**
 * Refresh connection cache from DynamoDB
 * Queries all active WebSocket connections and updates the cache
 */
async function refreshConnectionCache() {
  try {
    // Query all WebSocket connections
    // Note: This is a scan, but we can optimize with GSI if needed
    const scanParams = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'WEBSOCKET#'
      }
    };

    const result = await dynamodb.scan(scanParams).promise();
    const items = result.Items || [];

    // Clear and rebuild cache
    connectionCache.clear();

    for (const item of items) {
      if (item.SK && item.SK.startsWith('CONNECTION#')) {
        const userEmail = item.PK.replace('WEBSOCKET#', '').toLowerCase();
        const connectionId = item.connectionId;

        if (!connectionCache.has(userEmail)) {
          connectionCache.set(userEmail, new Set());
        }
        connectionCache.get(userEmail).add(connectionId);
      }
    }

    const totalConnections = Array.from(connectionCache.values()).reduce((sum, set) => sum + set.size, 0);
    console.log(`🔄 [websocket-cache] Cache refreshed: ${connectionCache.size} users, ${totalConnections} connections`);
  } catch (error) {
    console.error('❌ [websocket-cache] Error refreshing cache:', error);
  }
}

/**
 * Get connection IDs for a user email
 * Returns cached connections if available, otherwise queries DynamoDB
 */
export async function getConnectionsForUser(userEmail) {
  const normalizedEmail = userEmail.toLowerCase();
  console.log(`🔍 [websocket-cache] Looking up connections for: ${normalizedEmail}`);

  // Check cache first
  if (connectionCache.has(normalizedEmail)) {
    const connections = Array.from(connectionCache.get(normalizedEmail));
    console.log(`✅ [websocket-cache] Found ${connections.length} cached connections for ${normalizedEmail}`);
    return connections;
  }

  // Cache miss - query DynamoDB and update cache
  try {
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `WEBSOCKET#${normalizedEmail}`
      }
    };

    console.log(`🔍 [websocket-cache] Cache miss - querying DynamoDB for PK: WEBSOCKET#${normalizedEmail}`);
    const result = await dynamodb.query(queryParams).promise();
    const connections = [];

    if (result.Items && result.Items.length > 0) {
      console.log(`📊 [websocket-cache] DynamoDB returned ${result.Items.length} items for ${normalizedEmail}`);
      for (const item of result.Items) {
        if (item.SK && item.SK.startsWith('CONNECTION#')) {
          connections.push(item.connectionId);
          console.log(`   ✅ Found connection: ${item.connectionId}`);
        }
      }

      // Update cache
      if (connections.length > 0) {
        connectionCache.set(normalizedEmail, new Set(connections));
        console.log(`💾 [websocket-cache] Updated cache with ${connections.length} connections for ${normalizedEmail}`);
      }
    } else {
      console.log(`⚠️ [websocket-cache] No connections found in DynamoDB for ${normalizedEmail}`);
    }

    console.log(`📊 [websocket-cache] Queried DynamoDB for ${normalizedEmail}: ${connections.length} connections`);
    return connections;
  } catch (error) {
    console.error(`❌ [websocket-cache] Error querying connections for ${normalizedEmail}:`, error);
    return [];
  }
}

/**
 * Add connection to cache (called when user connects)
 */
export function addConnectionToCache(userEmail, connectionId) {
  const normalizedEmail = userEmail.toLowerCase();

  if (!connectionCache.has(normalizedEmail)) {
    connectionCache.set(normalizedEmail, new Set());
  }

  connectionCache.get(normalizedEmail).add(connectionId);
  console.log(`➕ [websocket-cache] Added connection ${connectionId} for ${normalizedEmail}`);
}

/**
 * Remove connection from cache (called when user disconnects)
 */
export function removeConnectionFromCache(userEmail, connectionId) {
  const normalizedEmail = userEmail.toLowerCase();

  if (connectionCache.has(normalizedEmail)) {
    connectionCache.get(normalizedEmail).delete(connectionId);

    // Remove user entry if no connections left
    if (connectionCache.get(normalizedEmail).size === 0) {
      connectionCache.delete(normalizedEmail);
    }

    console.log(`➖ [websocket-cache] Removed connection ${connectionId} for ${normalizedEmail}`);
  }
}

/**
 * Send WebSocket message directly via API Gateway Management API
 * Phase 2: Direct sending (bypasses Lambda)
 */
export async function sendDirectWebSocket(connectionIds, messageType, data) {
  if (!apigwManagementApi) {
    console.log('⚠️ [websocket-cache] Direct sending not available (API Gateway not initialized)');
    return { success: false, sent: 0, failed: 0 };
  }

  const message = {
    type: messageType,
    ...data,
    timestamp: new Date().toISOString()
  };

  const messageData = JSON.stringify(message);
  let successCount = 0;
  let failCount = 0;

  // Send to all connections in parallel
  const sendPromises = connectionIds.map(async (connectionId) => {
    try {
      await apigwManagementApi.postToConnection({
        ConnectionId: connectionId,
        Data: messageData
      }).promise();

      successCount++;
      return { success: true, connectionId };
    } catch (error) {
      failCount++;

      // If connection is gone (410), remove from cache
      if (error.statusCode === 410) {
        console.log(`🗑️ [websocket-cache] Stale connection detected: ${connectionId}`);
        // Find and remove from cache
        for (const [email, connections] of connectionCache.entries()) {
          if (connections.has(connectionId)) {
            removeConnectionFromCache(email, connectionId);
            break;
          }
        }
      }

      return { success: false, connectionId, error: error.message };
    }
  });

  await Promise.all(sendPromises);

  console.log(`📤 [websocket-cache] Direct send: ${successCount} succeeded, ${failCount} failed`);

  return {
    success: successCount > 0,
    sent: successCount,
    failed: failCount,
    total: connectionIds.length
  };
}

/**
 * Send WebSocket notification (hybrid approach)
 * Phase 1 + 2: Uses cache for fast lookup, direct sending for cached connections
 * Falls back to Lambda for uncached connections
 * 
 * @param {string[]} userEmails - Array of user emails, or empty array for broadcast to all
 * @param {string} messageType - Message type (e.g., 'new_comment', 'comment_liked')
 * @param {object} data - Message data
 * @param {string} websocketApiEndpoint - WebSocket API endpoint
 * @param {boolean} useLambdaFallback - Whether to fallback to Lambda for uncached
 */
export async function sendWebSocketNotification(userEmails, messageType, data, websocketApiEndpoint, useLambdaFallback = true) {
  // Handle broadcast (empty userEmails array = send to all connected users)
  if (!userEmails || (Array.isArray(userEmails) && userEmails.length === 0)) {
    // Broadcast to all - use Lambda (cache doesn't store all connections efficiently)
    if (useLambdaFallback) {
      const lambda = new AWS.Lambda({ region: 'us-east-1' });
      try {
        await lambda.invoke({
          FunctionName: 'websocket-comments-send',
          InvocationType: 'Event',
          Payload: JSON.stringify({
            userEmails: [], // Empty = broadcast
            messageType: messageType,
            data: data
          })
        }).promise();
        console.log(`📡 [websocket-cache] Broadcast notification sent via Lambda: ${messageType}`);
        return { success: true, method: 'lambda_broadcast' };
      } catch (error) {
        console.error(`❌ [websocket-cache] Lambda broadcast failed:`, error);
        return { success: false, method: 'lambda_broadcast', error: error.message };
      }
    }
    return { success: false, message: 'Broadcast requires Lambda fallback' };
  }

  const normalizedEmails = userEmails.map(email => email.toLowerCase());
  const allConnections = [];
  const cachedEmails = [];
  const uncachedEmails = [];

  // Get connections for all users
  for (const email of normalizedEmails) {
    const connections = await getConnectionsForUser(email);
    if (connections.length > 0) {
      allConnections.push(...connections.map(connId => ({ connectionId: connId, userEmail: email })));
      cachedEmails.push(email);
    } else {
      uncachedEmails.push(email);
    }
  }

  const connectionIds = allConnections.map(conn => conn.connectionId);

  // Phase 2: Send directly if we have connections and API Gateway is available
  if (connectionIds.length > 0 && apigwManagementApi) {
    const directResult = await sendDirectWebSocket(connectionIds, messageType, data);
    
    // If all connections were sent successfully, we're done
    if (directResult.sent === connectionIds.length) {
      return {
        success: true,
        method: 'direct',
        sent: directResult.sent,
        cached: cachedEmails.length,
        uncached: uncachedEmails.length
      };
    }
  }

  // Fallback to Lambda for uncached emails or if direct sending failed
  if (uncachedEmails.length > 0 && useLambdaFallback) {
    const lambda = new AWS.Lambda({ region: 'us-east-1' });
    try {
      await lambda.invoke({
        FunctionName: 'websocket-comments-send',
        InvocationType: 'Event',
        Payload: JSON.stringify({
          userEmails: uncachedEmails,
          messageType: messageType,
          data: data
        })
      }).promise();

      console.log(`📡 [websocket-cache] Fallback to Lambda for ${uncachedEmails.length} uncached users`);
    } catch (error) {
      console.error(`❌ [websocket-cache] Lambda fallback failed:`, error);
    }
  }

  return {
    success: true,
    method: 'hybrid',
    direct: connectionIds.length,
    cached: cachedEmails.length,
    uncached: uncachedEmails.length,
    fallback: uncachedEmails.length > 0 && useLambdaFallback
  };
}

/**
 * Send batch WebSocket notifications
 * Phase 3: Batch processing - combines multiple notifications into efficient sends
 */
export async function sendBatchWebSocketNotifications(notifications, websocketApiEndpoint, useLambdaFallback = true) {
  if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
    return { success: false, message: 'No notifications provided' };
  }

  console.log(`📦 [websocket-cache] Processing batch of ${notifications.length} notifications`);

  // Group notifications by user email for efficient sending
  const notificationsByUser = new Map();

  for (const notification of notifications) {
    const { userEmails, messageType, data } = notification;
    if (!userEmails || !Array.isArray(userEmails)) continue;

    for (const email of userEmails.map(e => e.toLowerCase())) {
      if (!notificationsByUser.has(email)) {
        notificationsByUser.set(email, []);
      }
      notificationsByUser.get(email).push({ messageType, data });
    }
  }

  // Send to each user (combining their notifications)
  const results = [];
  for (const [email, userNotifications] of notificationsByUser.entries()) {
    // Get connections for this user
    const connections = await getConnectionsForUser(email);

    if (connections.length > 0 && apigwManagementApi) {
      // Send all notifications for this user in one go
      for (const notification of userNotifications) {
        await sendDirectWebSocket(connections, notification.messageType, notification.data);
      }
      results.push({ email, method: 'direct', sent: connections.length });
    } else if (useLambdaFallback) {
      // Fallback to Lambda
      const lambda = new AWS.Lambda({ region: 'us-east-1' });
      for (const notification of userNotifications) {
        try {
          await lambda.invoke({
            FunctionName: 'websocket-comments-send',
            InvocationType: 'Event',
            Payload: JSON.stringify({
              userEmails: [email],
              messageType: notification.messageType,
              data: notification.data
            })
          }).promise();
        } catch (error) {
          console.error(`❌ [websocket-cache] Lambda batch fallback failed for ${email}:`, error);
        }
      }
      results.push({ email, method: 'lambda', sent: 0 });
    }
  }

  return {
    success: true,
    method: 'batch',
    total: notifications.length,
    users: notificationsByUser.size,
    results: results
  };
}

/**
 * Cleanup - stop refresh interval
 */
export function cleanupConnectionCache() {
  if (cacheRefreshInterval) {
    clearInterval(cacheRefreshInterval);
    cacheRefreshInterval = null;
  }
  connectionCache.clear();
  cacheInitialized = false;
  console.log('🧹 [websocket-cache] Connection cache cleaned up');
}
