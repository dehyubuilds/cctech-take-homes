const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = process.env.TABLE_NAME || 'Twilly';

// Initialize API Gateway Management API
let apigwManagementApi = null;
function initializeApiGateway() {
  if (apigwManagementApi) return apigwManagementApi;
  
  // Get endpoint from environment or event context
  const endpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                   process.env.WSS_ENDPOINT ||
                   (process.env.WEBSOCKET_API_ENDPOINT ? 
                     process.env.WEBSOCKET_API_ENDPOINT.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '') : 
                     null);
  
  if (endpoint) {
    apigwManagementApi = new AWS.ApiGatewayManagementApi({
      endpoint: endpoint
    });
  } else {
    console.log('⚠️ [websocket-send-unified] No WebSocket API endpoint configured');
  }
  
  return apigwManagementApi;
}

/**
 * Unified WebSocket message sender
 * Sends messages to specific user(s) for any notification type
 * 
 * Event format:
 * {
 *   userEmails: ["user1@example.com", "user2@example.com"],
 *   messageType: "notification" | "stream_processing" | "follow_request" | etc.,
 *   data: { ... message-specific data ... }
 * }
 */
exports.handler = async (event) => {
  console.log('📤 [websocket-send-unified] Sending WebSocket notification:', JSON.stringify(event, null, 2));
  
  // PHASE 3: Support batch notifications
  if (event.batch && Array.isArray(event.batch)) {
    console.log(`📦 [websocket-send-unified] Processing batch of ${event.batch.length} notifications`);
    const results = [];
    
    for (const notification of event.batch) {
      const result = await processSingleNotification(notification);
      results.push(result);
    }
    
    return {
      success: true,
      method: 'batch',
      total: event.batch.length,
      results: results
    };
  }
  
  // Single notification (backward compatible)
  return await processSingleNotification(event);
};

/**
 * Process a single WebSocket notification
 * Supports both single user and broadcast (empty userEmails)
 */
async function processSingleNotification(event) {
  const { userEmails, messageType, data } = event;
  
  // Handle broadcast (empty userEmails = send to all connected users)
  if (!userEmails || (Array.isArray(userEmails) && userEmails.length === 0)) {
    console.log('📡 [websocket-send-unified] Broadcasting to all connected users');
    
    // Query all WebSocket connections
    const scanParams = {
      TableName: table,
      FilterExpression: 'begins_with(PK, :pk)',
      ExpressionAttributeValues: {
        ':pk': 'WEBSOCKET#'
      }
    };
    
    const result = await dynamodb.scan(scanParams).promise();
    const connections = [];
    
    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        if (item.SK && item.SK.startsWith('CONNECTION#')) {
          connections.push({
            connectionId: item.connectionId,
            userEmail: item.PK.replace('WEBSOCKET#', '')
          });
        }
      }
    }
    
    console.log(`📡 [websocket-send-unified] Found ${connections.length} total connections for broadcast`);
    
    if (connections.length === 0) {
      return { success: false, message: 'No active connections found' };
    }
    
    // Send to all connections
    return await sendToConnections(connections, messageType, data);
  }
  
  if (!messageType) {
    console.log('⚠️ [websocket-send-unified] No message type provided');
    return { success: false, message: 'No message type provided' };
  }
  
  // Find all active connections for the recipient users
  const connections = [];
  
  for (const userEmail of userEmails) {
    const queryParams = {
      TableName: table,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `WEBSOCKET#${userEmail.toLowerCase()}`
      }
    };
    
    const result = await dynamodb.query(queryParams).promise();
    
    if (result.Items && result.Items.length > 0) {
      for (const item of result.Items) {
        if (item.SK && item.SK.startsWith('CONNECTION#')) {
          connections.push({
            connectionId: item.connectionId,
            userEmail: userEmail.toLowerCase()
          });
        }
      }
    }
  }
  
  console.log(`📡 [websocket-send-unified] Found ${connections.length} active connections for ${userEmails.length} users`);
  
  if (connections.length === 0) {
    return { success: false, message: 'No active connections found' };
  }
  
  return await sendToConnections(connections, messageType, data);
}

/**
 * Send message to connections
 */
async function sendToConnections(connections, messageType, data) {
  try {
    // Initialize API Gateway Management API
    const api = initializeApiGateway();
    if (!api) {
      return { success: false, error: 'API Gateway Management API not initialized' };
    }
    
    // Build message
    const message = {
      type: messageType,
      ...data,
      timestamp: new Date().toISOString()
    };
    
    const messageData = JSON.stringify(message);
    let successCount = 0;
    let failCount = 0;
    
    // Send message to all connections
    for (const connection of connections) {
      try {
        await api.postToConnection({
          ConnectionId: connection.connectionId,
          Data: messageData
        }).promise();
        
        successCount++;
        console.log(`✅ [websocket-send-unified] Sent to connection: ${connection.connectionId}`);
      } catch (error) {
        failCount++;
        console.error(`❌ [websocket-send-unified] Failed to send to ${connection.connectionId}:`, error);
        
        // If connection is gone, remove it from DynamoDB
        if (error.statusCode === 410) {
          try {
            await dynamodb.delete({
              TableName: table,
              Key: {
                PK: `WEBSOCKET#${connection.userEmail}`,
                SK: `CONNECTION#${connection.connectionId}`
              }
            }).promise();
            console.log(`🗑️ [websocket-send-unified] Removed stale connection: ${connection.connectionId}`);
          } catch (deleteError) {
            console.error(`❌ [websocket-send-unified] Failed to delete stale connection:`, deleteError);
          }
        }
      }
    }
    
    return {
      success: true,
      sent: successCount,
      failed: failCount,
      total: connections.length
    };
  } catch (error) {
    console.error('❌ [websocket-send-unified] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
