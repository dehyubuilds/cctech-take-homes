/**
 * Nuxt Server Plugin: WebSocket Connection Cache Initialization
 * 
 * Initializes the WebSocket connection cache on server startup
 * This enables Phase 1-3 optimizations for all API endpoints
 * 
 * Note: Server plugins run on server startup automatically
 */

export default defineNitroPlugin(async (nitroApp) => {
  // Get WebSocket API endpoint from environment or config
  // Default to the actual deployed WebSocket API endpoint
  const websocketApiEndpoint = process.env.WEBSOCKET_API_ENDPOINT || 
                                process.env.WSS_ENDPOINT ||
                                'wss://kwt0i091yd.execute-api.us-east-1.amazonaws.com/dev';

  // Initialize connection cache asynchronously (don't block server startup)
  // This will load all active connections and set up periodic refresh
  import('../utils/websocket-cache.js').then(({ initializeConnectionCache }) => {
    initializeConnectionCache(websocketApiEndpoint).catch(error => {
      console.error('❌ [websocket-cache-init] Failed to initialize cache:', error);
      // Non-blocking - Lambda fallback will handle notifications
    });
  });

  console.log('✅ [websocket-cache-init] WebSocket connection cache initialization scheduled');
});
