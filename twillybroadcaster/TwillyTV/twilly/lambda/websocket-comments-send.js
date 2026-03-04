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
if (process.env.WEBSOCKET_API_ENDPOINT) {
  // Extract domain from endpoint (remove https://)
  const endpoint = process.env.WEBSOCKET_API_ENDPOINT.replace('https://', '');
  apigwManagementApi = new AWS.ApiGatewayManagementApi({
    endpoint: endpoint
  });
}

/**
 * Send WebSocket message to specific user(s) when a comment is posted
 * This is called from the comment post endpoint
 */
exports.handler = async (event) => {
  console.log('📤 WebSocket Send Notification:', JSON.stringify(event, null, 2));
  
  const { userEmails, messageType, data } = event;
  
  if (!userEmails || !Array.isArray(userEmails) || userEmails.length === 0) {
    console.log('⚠️ [websocket-comments-send] No user emails provided');
    return { success: false, message: 'No user emails provided' };
  }
  
  if (!messageType) {
    console.log('⚠️ [websocket-comments-send] No messageType provided');
    return { success: false, message: 'No messageType provided' };
  }
  
  try {
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
    
    console.log(`📡 [websocket-comments-send] Found ${connections.length} active connections for ${userEmails.length} users`);
    
    // Build message based on messageType
    let message = {
      type: messageType,
      timestamp: new Date().toISOString()
    };
    
    // Add data fields based on messageType
    if (data) {
      Object.assign(message, data);
    } else {
      // Backward compatibility: support old format
      const { videoId, commentId, isPrivate, parentCommentId } = event;
      if (videoId) message.videoId = videoId;
      if (commentId) message.commentId = commentId;
      if (isPrivate !== undefined) message.isPrivate = isPrivate;
      if (parentCommentId) message.parentCommentId = parentCommentId;
    }
    
    const messageData = JSON.stringify(message);
    let successCount = 0;
    let failCount = 0;
    
    for (const connection of connections) {
      try {
        await apigwManagementApi.postToConnection({
          ConnectionId: connection.connectionId,
          Data: messageData
        }).promise();
        
        successCount++;
        console.log(`✅ [websocket-comments-send] Sent to connection: ${connection.connectionId}`);
      } catch (error) {
        failCount++;
        console.error(`❌ [websocket-comments-send] Failed to send to ${connection.connectionId}:`, error);
        
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
            console.log(`🗑️ [websocket-comments-send] Removed stale connection: ${connection.connectionId}`);
          } catch (deleteError) {
            console.error(`❌ [websocket-comments-send] Failed to delete stale connection:`, deleteError);
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
    console.error('❌ [websocket-comments-send] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
