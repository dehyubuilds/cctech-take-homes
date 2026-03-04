import { useWebSocketBrain } from '~/stores/WebSocketBrain';

export default defineNuxtPlugin(() => {
  const wsBrain = useWebSocketBrain();
  
  // Track current channel for persistent connections
  let currentChannel = null;
  
  // Initialize WebSocket on app start
  if (process.client) {
    console.log('🔌 [Plugin] Initializing persistent WebSocket connection...');
    
    // Initialize with guest user for home page
    if (!wsBrain.isInitialized) {
      wsBrain.initialize();
    }
  }
  
  // Provide methods for channel pages
  return {
    provide: {
      // Switch to a specific channel
      switchToChannel: (channelOwner) => {
        if (currentChannel === channelOwner) {
          console.log('🔄 [Plugin] Already connected to channel:', channelOwner);
          return;
        }
        
        console.log('🔄 [Plugin] Switching to channel:', channelOwner);
        currentChannel = channelOwner;
        
        if (wsBrain.isInitialized) {
          wsBrain.switchChannel(channelOwner);
        } else {
          wsBrain.initialize(channelOwner);
        }
        
        // Subscribe to channel-specific content
        wsBrain.subscribe('channels');
        wsBrain.subscribe('live');
        wsBrain.subscribe('episodes');
      },
      
      // Get current WebSocket state
      getWebSocketState: () => ({
        isConnected: wsBrain.isConnected,
        isInitialized: wsBrain.isInitialized,
        connectionStatus: wsBrain.connectionStatus,
        currentChannel
      }),
      
      // Retry connection
      retryWebSocket: () => {
        console.log('🔄 [Plugin] Retrying WebSocket connection...');
        wsBrain.disconnect();
        setTimeout(() => {
          if (currentChannel) {
            wsBrain.initialize(currentChannel);
          } else {
            wsBrain.initialize();
          }
        }, 1000);
      }
    }
  };
});
