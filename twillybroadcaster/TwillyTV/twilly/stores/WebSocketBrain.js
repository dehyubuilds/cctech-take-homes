import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from './auth';

export const useWebSocketBrain = defineStore('webSocketBrain', () => {
  // WebSocket connection
  const ws = ref(null);
  const isConnected = ref(false);
  const connectionStatus = ref('disconnected');
  const reconnectAttempts = ref(0);
  const maxReconnectAttempts = 5;
  
  // Use the existing WebSocket URL from your current configuration
  const getWebSocketUrl = (channelOwner = null) => {
    const userId = getCurrentUserId();
    
    // If we have a channel owner (for channel pages), use that as the target user
    if (channelOwner) {
      console.log('🔍 [DEBUG] Using channel owner for WebSocket:', channelOwner);
      return `wss://0t56fn3cml.execute-api.us-east-1.amazonaws.com/production/?userId=${encodeURIComponent(channelOwner)}`;
    }
    
    // If we have an authenticated user, use their ID
    if (userId) {
      return `wss://0t56fn3cml.execute-api.us-east-1.amazonaws.com/production/?userId=${encodeURIComponent(userId)}`;
    }
    
    // For unauthenticated users (like on home page), use guest user ID
    console.log('🔍 [DEBUG] No authenticated user found, using guest user ID for home page');
    const guestUserId = 'guest_home_user';
    return `wss://0t56fn3cml.execute-api.us-east-1.amazonaws.com/production/?userId=${encodeURIComponent(guestUserId)}`;
  };
  
  // Helper function to get current user ID (username)
  const getCurrentUserId = () => {
    // Try to get username from auth store
    const authStore = useAuthStore();
    if (authStore.user?.attributes?.username) {
      return authStore.user.attributes.username;
    }
    if (authStore.user?.username) {
      return authStore.user.username;
    }
    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('username');
    }
    return null;
  };

  // Track current channel owner for WebSocket connections
  const currentChannelOwner = ref(null);

  // Helper function to get user ID for WebSocket connection
  const getWebSocketUserId = () => {
    // If we have a specific channel owner, use that
    if (currentChannelOwner.value) {
      return currentChannelOwner.value;
    }
    
    // Otherwise, try to get the current user's username
    const currentUserId = getCurrentUserId();
    if (currentUserId) {
      return currentUserId;
    }
    
    // Fallback to guest user ID
    return 'guest_home_user';
  };
  
  // Centralized message handling
  const messageHandlers = ref(new Map());
  const subscriptions = ref(new Set());
  
  // Connection management
  const isInitialized = ref(false);
  const lastHeartbeat = ref(null);
  const heartbeatInterval = ref(null);
  
  // Error handling
  const error = ref(null);
  const connectionLog = ref([]);
  
  // Content state for real-time updates
  const channels = ref([]);
  const featuredContent = ref([]);
  const liveStreams = ref([]);
  const userSubscriptions = ref([]);
  const recentEpisodes = ref([]);
  
  // Computed properties
  const isHealthy = computed(() => {
    if (!isConnected.value) return false;
    if (!lastHeartbeat.value) return true; // No heartbeat yet
    const now = Date.now();
    const heartbeatAge = now - lastHeartbeat.value;
    return heartbeatAge < 30000; // 30 seconds
  });
  
  // Initialize WebSocket connection
  const initialize = (channelOwner = null) => {
    if (isInitialized.value) {
      console.log('🧠 WebSocket Brain already initialized, reusing existing connection');
      return;
    }
    
    console.log('🧠 Initializing WebSocket Brain...');
    console.log('🔍 Current user ID:', getCurrentUserId());
    console.log('🔍 Channel owner:', channelOwner);
    console.log('🔍 WebSocket URL:', getWebSocketUrl(channelOwner));
    isInitialized.value = true;
    
    // Ensure all properties are properly initialized
    if (!channels.value) channels.value = [];
    if (!featuredContent.value) featuredContent.value = [];
    if (!liveStreams.value) liveStreams.value = [];
    if (!userSubscriptions.value) userSubscriptions.value = [];
    if (!recentEpisodes.value) recentEpisodes.value = [];
    if (!subscriptions.value) subscriptions.value = new Set();
    if (!messageHandlers.value) messageHandlers.value = new Map();
    if (!connectionLog.value) connectionLog.value = [];
    
    connect(channelOwner);
  };
  
  // Connect to WebSocket
  const connect = (channelOwner = null) => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
    
    console.log('🔌 Connecting to WebSocket...');
    console.log('🔍 Channel owner:', channelOwner);
    console.log('🔍 WebSocket URL:', getWebSocketUrl(channelOwner));
    connectionStatus.value = 'connecting';
    
    try {
      ws.value = new WebSocket(getWebSocketUrl(channelOwner));
      console.log('🔌 WebSocket instance created');
      
      ws.value.onopen = handleOpen;
      ws.value.onmessage = handleMessage;
      ws.value.onerror = handleError;
      ws.value.onclose = handleClose;
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      handleConnectionError(error);
    }
  };
  
  // Handle WebSocket open
  const handleOpen = () => {
    console.log('✅ WebSocket connected');
    isConnected.value = true;
    connectionStatus.value = 'connected';
    reconnectAttempts.value = 0;
    error.value = null;
    
    // Start heartbeat
    startHeartbeat();
    
    // Resubscribe to all previous subscriptions
    resubscribeAll();
    
    // Log connection
    logConnection('connected');
  };
  
  // Handle WebSocket messages
  const handleMessage = (event) => {
    try {
      // Try to parse as JSON first
      const message = JSON.parse(event.data);
      console.log('🧠 WebSocket Brain received JSON:', message);
      
      // Update heartbeat
      lastHeartbeat.value = Date.now();
      
      // Route message to appropriate handlers
      routeMessage(message);
      
    } catch (error) {
      // If JSON parsing fails, check if it's a plain text message
      const plainText = event.data;
      console.log('🧠 WebSocket Brain received plain text:', plainText);
      
      // Handle common plain text messages
      if (plainText === 'Subscription updated') {
        console.log('✅ Subscription status updated successfully');
        // Update heartbeat for subscription confirmations
        lastHeartbeat.value = Date.now();
        return;
      }
      
      if (plainText === 'Connected') {
        console.log('✅ WebSocket connection confirmed');
        // Update heartbeat for connection confirmations
        lastHeartbeat.value = Date.now();
        return;
      }
      
      // Log other plain text messages
      console.log('📝 Received plain text message:', plainText);
    }
  };
  
  // Route messages to appropriate handlers
  const routeMessage = (message) => {
    const { type, targetType, data, content } = message;
    
    // Handle different message types
    switch (type) {
      case 'content':
        handleContentUpdate(targetType, data);
        break;
      case 'channels':
        handleChannelsUpdate(data);
        break;
      case 'featured':
        handleFeaturedUpdate(data);
        break;
      case 'live':
        handleLiveUpdate(data);
        break;
      case 'episodes':
        handleEpisodesUpdate(data);
        break;
      case 'series':
        handleSeriesUpdate(data);
        break;
      case 'fire':
        handleFireUpdate(data);
        break;
      case 'status':
        handleStatusUpdate(data);
        break;
      case 'ads':
        handleAdsUpdate(data);
        break;
      case 'heartbeat':
        handleHeartbeat(data);
        break;
      case 'reaction':
        handleReactionUpdate(data);
        break;
      case 'text':
        handleTextMessage(data);
        break;
      default:
        // Route to custom handlers if registered
        const handler = messageHandlers.value.get(type);
        if (handler) {
          handler(message);
        } else {
          console.log('Unhandled message type:', type, message);
        }
    }
  };
  
  // Content update handlers
  const handleContentUpdate = (targetType, data) => {
    console.log('Content update for:', targetType, data);
    // Update local state based on target type
    switch (targetType) {
      case 'channels':
        channels.value = data;
        break;
      case 'featured':
        featuredContent.value = data;
        break;
      case 'live':
        liveStreams.value = data;
        break;
      case 'episodes':
        recentEpisodes.value = data;
        break;
    }
  };
  
  const handleChannelsUpdate = (data) => {
    channels.value = data;
  };
  
  const handleFeaturedUpdate = (data) => {
    featuredContent.value = data;
  };
  
  const handleLiveUpdate = (data) => {
    liveStreams.value = data;
  };
  
  const handleEpisodesUpdate = (data) => {
    recentEpisodes.value = data;
  };
  
  const handleSeriesUpdate = (data) => {
    // Handle series-specific updates
    console.log('Series update:', data);
  };
  
  const handleFireUpdate = (data) => {
    // Handle fire home page updates
    console.log('Fire update:', data);
  };
  
  const handleStatusUpdate = (data) => {
    // Handle status updates
    console.log('Status update:', data);
  };
  
  const handleAdsUpdate = (data) => {
    // Handle ads updates
    console.log('Ads update:', data);
  };
  
  const handleHeartbeat = (data) => {
    lastHeartbeat.value = Date.now();
    console.log('Heartbeat received');
  };
  
  const handleReactionUpdate = (data) => {
    // Handle reaction updates
    console.log('Reaction update:', data);
  };
  
  const handleTextMessage = (data) => {
    // Handle text messages
    console.log('Text message:', data);
  };
  
  // Subscribe to content types
  const subscribe = (targetType) => {
    if (!isConnected.value) {
      console.warn('WebSocket not connected, cannot subscribe to:', targetType);
      return;
    }
    
    subscriptions.value.add(targetType);
    
    // Create subscription message - include userId (authenticated or guest)
    const message = {
      type: 'subscribe',
      targetType: targetType
    };
    
    // Add userId (channel owner, authenticated user, or guest user)
    const userId = getWebSocketUserId();
    message.userId = userId;
    console.log('🔍 [DEBUG] Using user ID for subscription:', userId);
    
    sendMessage(message);
    console.log('Subscribed to:', targetType);
  };
  
  // Unsubscribe from content types
  const unsubscribe = (targetType) => {
    subscriptions.value.delete(targetType);
    
    const message = {
      type: 'unsubscribe',
      targetType: targetType
    };
    
    sendMessage(message);
    console.log('Unsubscribed from:', targetType);
  };
  
  // Send message to WebSocket
  const sendMessage = (message) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return false;
    }
    
    try {
      ws.value.send(JSON.stringify(message));
      console.log('Message sent:', message);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  };
  
  // Request initial data for content types
  const requestInitialData = async (contentTypes) => {
    if (!Array.isArray(contentTypes)) {
      contentTypes = [contentTypes];
    }
    
    // For now, use HTTP API calls to get initial data
    // This ensures we have data even if WebSocket is not connected
    for (const contentType of contentTypes) {
      try {
        const response = await fetch(`/api/content/${contentType}`);
        if (response.ok) {
          const data = await response.json();
          handleContentUpdate(contentType, data);
        }
      } catch (error) {
        console.error(`Error fetching initial ${contentType} data:`, error);
      }
    }
    
    // Also subscribe to real-time updates
    contentTypes.forEach(type => subscribe(type));
  };
  
  // Request specific content
  const requestContent = async (contentType, params = {}) => {
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`/api/content/${contentType}?${queryString}`);
      if (response.ok) {
        const data = await response.json();
        handleContentUpdate(contentType, data);
        return data;
      }
    } catch (error) {
      console.error(`Error requesting ${contentType} content:`, error);
    }
  };
  
  // Refresh content
  const refreshContent = (contentType) => {
    if (subscriptions.value.has(contentType)) {
      requestContent(contentType);
    }
  };
  
  // Register custom message handlers
  const onMessage = (messageType, handler) => {
    messageHandlers.value.set(messageType, handler);
  };
  
  // Remove custom message handlers
  const offMessage = (messageType) => {
    messageHandlers.value.delete(messageType);
  };
  
  // Start heartbeat
  const startHeartbeat = () => {
    if (heartbeatInterval.value) {
      clearInterval(heartbeatInterval.value);
    }
    
    heartbeatInterval.value = setInterval(() => {
      if (isConnected.value) {
        sendMessage({ type: 'heartbeat' });
      }
    }, 25000); // Send heartbeat every 25 seconds
  };
  
  // Stop heartbeat
  const stopHeartbeat = () => {
    if (heartbeatInterval.value) {
      clearInterval(heartbeatInterval.value);
      heartbeatInterval.value = null;
    }
  };
  
  // Handle WebSocket errors
  const handleError = (event) => {
    console.error('WebSocket error:', event);
    error.value = 'WebSocket connection error';
    logConnection('error', event);
  };
  
  // Handle WebSocket close
  const handleClose = (event) => {
    console.log('WebSocket closed:', event.code, event.reason);
    isConnected.value = false;
    connectionStatus.value = 'disconnected';
    
    stopHeartbeat();
    
    // Attempt reconnection with exponential backoff
    if (reconnectAttempts.value < maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.value), 30000);
      reconnectAttempts.value++;
      
      console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.value}/${maxReconnectAttempts})`);
      
      setTimeout(() => {
        connect();
      }, delay);
    } else {
      error.value = 'Max reconnection attempts reached';
      logConnection('max_reconnect_attempts');
    }
    
    logConnection('disconnected', event);
  };
  
  // Handle connection errors
  const handleConnectionError = (error) => {
    console.error('Connection error:', error);
    this.error = error.message || 'Connection failed';
    logConnection('connection_error', error);
  };
  
  // Resubscribe to all previous subscriptions
  const resubscribeAll = () => {
    subscriptions.value.forEach(targetType => {
      subscribe(targetType);
    });
  };
  
  // Log connection events
  const logConnection = (event, details = null) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details
    };
    
    connectionLog.value.push(logEntry);
    
    // Keep only last 100 log entries
    if (connectionLog.value.length > 100) {
      connectionLog.value.shift();
    }
  };
  
  // Disconnect WebSocket
  const disconnect = () => {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
    
    isConnected.value = false;
    connectionStatus.value = 'disconnected';
    stopHeartbeat();
    
    logConnection('disconnected_manually');
  };

  // Switch channel for persistent connections
  const switchChannel = (newChannelOwner) => {
    console.log('🔄 [WebSocket] Switching channel from current to:', newChannelOwner);
    
    // Update current channel owner
    currentChannelOwner.value = newChannelOwner;
    
    // If we're already connected to this channel, do nothing
    if (ws.value && ws.value.url && ws.value.url.includes(`userId=${encodeURIComponent(newChannelOwner)}`)) {
      console.log('🔄 [WebSocket] Already connected to this channel, no switch needed');
      return;
    }
    
    // If we have an existing connection, close it gracefully
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      console.log('🔄 [WebSocket] Closing existing connection to switch channels');
      ws.value.close(1000, 'Channel switch');
    }
    
    // Connect to the new channel
    setTimeout(() => {
      connect(newChannelOwner);
    }, 100);
  };
  
  // Cleanup resources
  const cleanup = () => {
    disconnect();
    messageHandlers.value.clear();
    subscriptions.value.clear();
    isInitialized.value = false;
    reconnectAttempts.value = 0;
  };
  
  // Get connection statistics
  const getStats = () => {
    return {
      isConnected: isConnected.value,
      connectionStatus: connectionStatus.value,
      reconnectAttempts: reconnectAttempts.value,
      maxReconnectAttempts,
      subscriptions: Array.from(subscriptions.value),
      messageHandlers: Array.from(messageHandlers.value.keys()),
      lastHeartbeat: lastHeartbeat.value,
      isHealthy: isHealthy.value
    };
  };
  
  // Enhanced methods for existing functionality compatibility
  const publishMessage = (content, targetType = 'defaultType') => {
    return sendMessage({
      type: 'text',
      content: content || 'Default message content',
      targetType
    });
  };
  
  const changeStatus = (online, statusTargetType = 'status') => {
    return sendMessage({
      type: 'text',
      content: online ? 'Online' : 'Offline',
      targetType: statusTargetType
    });
  };
  
  const sendReaction = (emoji, targetType = 'reaction') => {
    return sendMessage({
      type: 'reaction',
      emoji,
      targetType
    });
  };
  
  // Legacy compatibility methods
  const setupWebSocket = () => {
    console.warn('setupWebSocket is deprecated, use initialize instead');
    initialize();
  };
  
  const closeWebSocket = () => {
    console.warn('closeWebSocket is deprecated, use disconnect instead');
    disconnect();
  };
  
  return {
    // State
    ws,
    isConnected,
    connectionStatus,
    error,
    connectionLog,
    currentChannelOwner,
    
    // Content state
    channels,
    featuredContent,
    liveStreams,
    userSubscriptions,
    recentEpisodes,
    
    // Computed
    isHealthy,
    
    // Core methods
    initialize,
    connect,
    disconnect,
    switchChannel,
    subscribe,
    unsubscribe,
    sendMessage,
    cleanup,
    getStats,
    
    // Content methods
    requestInitialData,
    requestContent,
    refreshContent,
    
    // Message handling
    onMessage,
    offMessage,
    
    // Enhanced methods
    publishMessage,
    changeStatus,
    sendReaction,
    
    // Legacy compatibility
    setupWebSocket,
    closeWebSocket
  };
});
