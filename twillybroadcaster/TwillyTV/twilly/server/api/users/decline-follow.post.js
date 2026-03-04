import AWS from 'aws-sdk';
import { defineEventHandler, readBody, createError } from 'h3';

AWS.config.update({
  accessKeyId: 'AKIASCPOEM7JYLK5BJFR',
  secretAccessKey: '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',
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const table = 'Twilly';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    let { userEmail, requesterEmail } = body;

    if (!userEmail || !requesterEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: userEmail and requesterEmail'
      });
    }

    // CRITICAL: Normalize emails to lowercase to prevent case-sensitivity issues
    userEmail = userEmail.toLowerCase();
    requesterEmail = requesterEmail.toLowerCase();

    console.log(`❌ [decline-follow] ${userEmail} declining follow request from ${requesterEmail}`);

    // Get the follow request
    const requestParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`
      }
    };

    const requestResult = await dynamodb.get(requestParams).promise();

    if (!requestResult.Item) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Follow request not found'
      });
    }

    // Update follow request status to declined
    // CRITICAL: Once declined, requester still sees "Requested" (can't request again)
    // This maintains one-way flow: Request → Requested → (stays Requested if declined)
    const updateParams = {
      TableName: table,
      Key: {
        PK: `USER#${userEmail}`,
        SK: `FOLLOW_REQUEST#${requesterEmail}`
      },
      UpdateExpression: 'SET #status = :status, respondedAt = :respondedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'declined',
        ':respondedAt': new Date().toISOString()
      }
    };

    await dynamodb.update(updateParams).promise();

    console.log(`✅ [decline-follow] Follow request declined`);
    
    // PHASE 1-3: Send WebSocket notification via optimized cache service
    try {
      const { sendWebSocketNotification } = await import('../../utils/websocket-cache.js');
      const websocketApiEndpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                                  process.env.WSS_ENDPOINT ||
                                  'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';
      
      await sendWebSocketNotification(
        [requesterEmail],
        'follow_response',
        {
          requesterEmail: requesterEmail,
          status: 'declined'
        },
        websocketApiEndpoint,
        true // Lambda fallback for backward compatibility
      );
      console.log(`📡 [decline-follow] WebSocket notification sent to ${requesterEmail}`);
    } catch (wsError) {
      console.error(`⚠️ [decline-follow] Failed to send WebSocket notification: ${wsError.message}`);
      // Continue - WebSocket is non-blocking
    }

    return {
      success: true,
      message: 'Follow request declined',
      status: 'declined'
    };

  } catch (error) {
    console.error('❌ [decline-follow] Error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to decline follow request'
    });
  }
});
