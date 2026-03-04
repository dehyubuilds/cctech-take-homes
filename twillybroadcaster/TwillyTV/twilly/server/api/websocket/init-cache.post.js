/**
 * WebSocket Cache Initialization Endpoint
 * 
 * Manually initialize the WebSocket connection cache
 * This can be called on server startup or as needed
 */

import { initializeConnectionCache } from '../../utils/websocket-cache.js';

export default defineEventHandler(async (event) => {
  try {
    const websocketApiEndpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                                process.env.WSS_ENDPOINT ||
                                'wss://YOUR_WEBSOCKET_API_ID.execute-api.us-east-1.amazonaws.com/dev';

    await initializeConnectionCache(websocketApiEndpoint);

    return {
      success: true,
      message: 'WebSocket connection cache initialized',
      endpoint: websocketApiEndpoint
    };
  } catch (error) {
    console.error('❌ [websocket/init-cache] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
