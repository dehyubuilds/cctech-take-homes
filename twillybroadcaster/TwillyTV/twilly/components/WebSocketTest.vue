<template>
  <div class="websocket-test bg-gradient-to-br from-black/30 via-black/40 to-black/30 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-4 shadow-xl">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-white flex items-center gap-2">
        <Icon name="heroicons:signal" class="w-5 h-5 text-teal-400" />
        WebSocket Test
      </h3>
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full" :class="{
          'bg-green-500': isConnected,
          'bg-red-500': !isConnected,
          'bg-yellow-500': isConnecting
        }"></div>
        <span class="text-sm text-gray-300">
          {{ connectionStatus }}
        </span>
      </div>
    </div>
    
    <div class="space-y-3">
      <div class="flex gap-2">
        <button
          @click="connect"
          :disabled="isConnected || isConnecting"
          class="px-3 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 text-sm"
        >
          Connect
        </button>
        
        <button
          @click="disconnect"
          :disabled="!isConnected"
          class="px-3 py-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-300 border border-red-500/30 rounded-xl hover:from-red-500/30 hover:to-orange-500/30 transition-all duration-300 shadow-md hover:shadow-lg"
          title="Disconnect"
        >
          <Icon name="heroicons:stop" class="w-5 h-5" />
          <span class="hidden sm:inline">Disconnect</span>
        </button>
        
        <!-- Network Test Button -->
        <button
          @click="testNetworkConnectivity"
          class="px-3 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border border-blue-500/30 rounded-xl hover:from-blue-500/30 hover:to-cyan-500/30 transition-all duration-300 shadow-md hover:shadow-lg"
          title="Test Network"
        >
          <Icon name="heroicons:signal" class="w-5 h-5" />
          <span class="hidden sm:inline">Network Test</span>
        </button>
        
        <button
          @click="sendTestMessage"
          :disabled="!isConnected"
          class="px-3 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 text-sm"
        >
          Test Message
        </button>
      </div>
      
      <div class="text-xs text-gray-400">
        Endpoint: {{ wsUrl }}
      </div>
      
      <div v-if="lastMessage" class="text-xs text-gray-300 bg-black/20 p-2 rounded border border-white/10">
        Last message: {{ lastMessage }}
      </div>
      
      <!-- Debug Information -->
      <div class="text-xs text-gray-400 bg-black/30 p-3 rounded border border-white/20 mt-3">
        <div class="font-semibold mb-2">🔍 Debug Info:</div>
        <div>WebSocket URL: {{ getWebSocketUrl() }}</div>
        <div>Base URL: {{ wsUrl }}</div>
        <div>Ready State: {{ ws?.readyState || 'null' }} ({{ getReadyStateText(ws?.readyState) }})</div>
        <div>Connection Status: {{ connectionStatus }}</div>
        <div>Is Connected: {{ isConnected }}</div>
        <div>Is Connecting: {{ isConnecting }}</div>
        <div>WebSocket Instance: {{ ws ? 'Exists' : 'Null' }}</div>
        <div>Last Message Length: {{ lastMessage?.length || 0 }}</div>
        <div>Username (User ID): {{ getCurrentUserId() || 'Not available' }}</div>
        <div>Auth Status: {{ authStore.authenticated ? 'Authenticated' : 'Not authenticated' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '~/stores/auth';

// Get auth store
const authStore = useAuthStore();

// WebSocket state
const ws = ref(null);
const isConnected = ref(false);
const isConnecting = ref(false);
const connectionStatus = ref('disconnected');
const lastMessage = ref('');

            // Use the existing working WebSocket endpoint temporarily for testing
            const wsUrl = 'wss://0t56fn3cml.execute-api.us-east-1.amazonaws.com/production/';

// Use the existing working WebSocket endpoint temporarily for testing
// Include userId as query parameter for authentication during connection
const getWebSocketUrl = () => {
  const userId = getCurrentUserId();
  if (userId) {
    return `${wsUrl}?userId=${encodeURIComponent(userId)}`;
  }
  // For unauthenticated users on home page, use a guest user ID
  console.log('🔍 [DEBUG] No userId available, using guest user ID for home page');
  const guestUserId = 'guest_home_user';
  return `${wsUrl}?userId=${encodeURIComponent(guestUserId)}`;
};

// Helper function to get readable ready state
const getReadyStateText = (readyState) => {
  switch (readyState) {
    case 0: return 'CONNECTING';
    case 1: return 'OPEN';
    case 2: return 'CLOSING';
    case 3: return 'CLOSED';
    default: return 'UNKNOWN';
  }
};

// Get current user ID (username)
const getCurrentUserId = () => {
  // Prioritize username from auth store
  if (authStore.user?.attributes?.username) {
    return authStore.user.attributes.username;
  }
  // Fallback to username from user object
  if (authStore.user?.username) {
    return authStore.user.username;
  }
  // Last resort - check if we have any username stored
  if (process.client) {
    const currentUserId = authStore.user?.attributes?.sub;
    if (currentUserId) {
      const userSpecificKey = `userUsername_${currentUserId}`;
      const storedUsername = localStorage.getItem(userSpecificKey);
      if (storedUsername) {
        return storedUsername;
      }
    }
  }
  return null;
};

// Test network connectivity to WebSocket endpoint
const testNetworkConnectivity = async () => {
  console.log('🔍 [DEBUG] Testing network connectivity to:', wsUrl);
  
  try {
    // Try to fetch the WebSocket endpoint (this will fail but show us the error)
    const response = await fetch(wsUrl.replace('wss://', 'https://'), {
      method: 'GET',
      mode: 'no-cors'
    });
    console.log('🔍 [DEBUG] Network test response:', response);
  } catch (error) {
    console.log('🔍 [DEBUG] Network test error (expected):', error);
    console.log('🔍 [DEBUG] Error name:', error.name);
    console.log('🔍 [DEBUG] Error message:', error.message);
  }
  
  // Also try a simple ping to the domain
  const domain = wsUrl.replace('wss://', '').split('/')[0];
  console.log('🔍 [DEBUG] Testing domain connectivity to:', domain);
  
  try {
    const pingResponse = await fetch(`https://${domain}`, {
      method: 'HEAD',
      mode: 'no-cors'
    });
    console.log('🔍 [DEBUG] Domain ping response:', pingResponse);
  } catch (error) {
    console.log('🔍 [DEBUG] Domain ping error:', error);
  }
};

// Connect to WebSocket
const connect = () => {
  console.log('🔍 [DEBUG] connect() called');
  console.log('🔍 [DEBUG] Current WebSocket state:', ws.value?.readyState);
  console.log('🔍 [DEBUG] WebSocket URL:', wsUrl);
  
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    console.log('🔍 [DEBUG] WebSocket already connected, readyState:', ws.value.readyState);
    return;
  }
  
  console.log('🔌 Connecting to WebSocket...');
  console.log('🔍 [DEBUG] Setting connection state to connecting');
  isConnecting.value = true;
  connectionStatus.value = 'connecting';
  
  // First test network connectivity
  console.log('🔍 [DEBUG] Running network connectivity test first');
  testNetworkConnectivity().then(() => {
    console.log('🔍 [DEBUG] Network test completed, proceeding with WebSocket connection');
    
    try {
      console.log('🔍 [DEBUG] Creating new WebSocket instance');
      ws.value = new WebSocket(getWebSocketUrl());
      console.log('🔍 [DEBUG] WebSocket instance created:', ws.value);
      
      console.log('🔍 [DEBUG] Setting up event handlers');
      
      ws.value.onopen = () => {
        console.log('🔍 [DEBUG] onopen event fired');
        console.log('🔍 [DEBUG] WebSocket readyState:', ws.value.readyState);
        console.log('🔍 [DEBUG] WebSocket URL:', ws.value.url);
        console.log('🔍 [DEBUG] WebSocket protocol:', ws.value.protocol);
        console.log('🔍 [DEBUG] WebSocket extensions:', ws.value.extensions);
        
        console.log('✅ WebSocket connected');
        isConnected.value = true;
        isConnecting.value = false;
        connectionStatus.value = 'connected';
        
        // Send subscription message matching the working components format
        // The working components use 'type' field, not 'route'
        // The API requires userId for connection
        const userId = getCurrentUserId();
        console.log('🔍 [DEBUG] Current user ID:', userId);
        
        // Create subscription message - include userId (authenticated or guest)
        const subscriptionMessage = { 
          type: "subscribe", 
          targetType: "test"
        };
        
        // Add userId (authenticated user or guest user)
        if (userId) {
          subscriptionMessage.userId = userId;
          console.log('🔍 [DEBUG] Using authenticated user ID:', userId);
        } else {
          // Use guest user ID for unauthenticated users
          const guestUserId = 'guest_home_user';
          subscriptionMessage.userId = guestUserId;
          console.log('🔍 [DEBUG] Using guest user ID for home page:', guestUserId);
        }
        
        console.log('🔍 [DEBUG] Sending subscription message:', subscriptionMessage);
        console.log('🔍 [DEBUG] Message as JSON:', JSON.stringify(subscriptionMessage));
        
        ws.value.send(JSON.stringify(subscriptionMessage));
        console.log('📤 Subscription message sent');
      };
      
      ws.value.onmessage = (event) => {
        console.log('🔍 [DEBUG] onmessage event fired');
        console.log('🔍 [DEBUG] Raw message data:', event.data);
        console.log('🔍 [DEBUG] Message type:', typeof event.data);
        console.log('🔍 [DEBUG] Message length:', event.data?.length);
        
        handleMessage(event);
      };
      
      ws.value.onerror = (error) => {
        console.log('🔍 [DEBUG] onerror event fired');
        console.log('🔍 [DEBUG] Error event details:', error);
        console.log('🔍 [DEBUG] Error type:', error.type);
        console.log('🔍 [DEBUG] Error target:', error.target);
        console.log('🔍 [DEBUG] Error currentTarget:', error.currentTarget);
        console.log('🔍 [DEBUG] WebSocket readyState at error:', ws.value?.readyState);
        console.log('🔍 [DEBUG] WebSocket URL at error:', ws.value?.url);
        
        console.error('❌ WebSocket error:', error);
        connectionStatus.value = 'error';
      };
      
      ws.value.onclose = (event) => {
        console.log('🔍 [DEBUG] onclose event fired');
        console.log('🔍 [DEBUG] Close event details:', event);
        console.log('🔍 [DEBUG] Close code:', event.code);
        console.log('🔍 [DEBUG] Close reason:', event.reason);
        console.log('🔍 [DEBUG] Close wasClean:', event.wasClean);
        console.log('🔍 [DEBUG] WebSocket readyState at close:', ws.value?.readyState);
        
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        isConnected.value = false;
        isConnecting.value = false;
        connectionStatus.value = 'disconnected';
        ws.value = null;
      };
      
      console.log('🔍 [DEBUG] Event handlers set up successfully');
      console.log('🔍 [DEBUG] WebSocket readyState after setup:', ws.value.readyState);
      
    } catch (error) {
      console.log('🔍 [DEBUG] Error in connect() function:', error);
      console.log('🔍 [DEBUG] Error stack:', error.stack);
      console.error('Failed to create WebSocket:', error);
      isConnecting.value = false;
      connectionStatus.value = 'error';
    }
  });
};

// Handle incoming WebSocket messages
const handleMessage = (event) => {
  console.log('🔍 [DEBUG] handleMessage() called');
  console.log('🔍 [DEBUG] Event object:', event);
  
  try {
    const rawData = event.data;
    console.log('🔍 [DEBUG] Raw message data:', rawData);
    
    // Check if it's a string (plain text) or JSON
    if (typeof rawData === 'string') {
      // Handle plain text messages
      lastMessage.value = rawData;
      console.log('📨 Received plain text message:', rawData);
    } else {
      // Handle JSON messages
      console.log('🔍 [DEBUG] Attempting to parse message as JSON');
      const parsedMessage = JSON.parse(rawData);
      lastMessage.value = JSON.stringify(parsedMessage, null, 2);
      console.log('📨 Received JSON message:', parsedMessage);
    }
  } catch (error) {
    // Only log parsing errors for actual JSON parsing failures
    if (error instanceof SyntaxError && typeof event.data === 'string') {
      // This is likely a plain text message, not a JSON parsing error
      lastMessage.value = event.data;
      console.log('📨 Received plain text message:', event.data);
    } else {
      console.error('❌ Error processing message:', error);
      lastMessage.value = `Error: ${error.message}`;
    }
  }
};

// Send test message
const sendTestMessage = () => {
  console.log('🔍 [DEBUG] sendTestMessage() called');
  console.log('🔍 [DEBUG] WebSocket instance:', ws.value);
  console.log('🔍 [DEBUG] WebSocket readyState:', ws.value?.readyState);
  console.log('🔍 [DEBUG] Is WebSocket OPEN?', ws.value?.readyState === WebSocket.OPEN);
  
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
    console.log('🔍 [DEBUG] WebSocket not ready for sending');
    console.error('WebSocket not connected');
    return;
  }
  
  // Create test message - include userId (authenticated or guest)
  const testMessage = {
    type: 'text',
    content: 'Hello from Twilly frontend!',
    targetType: 'defaultType'
  };
  
  // Add userId (authenticated user or guest user)
  const userId = getCurrentUserId();
  if (userId) {
    testMessage.userId = userId;
    console.log('🔍 [DEBUG] Using authenticated user ID for test message:', userId);
  } else {
    // Use guest user ID for unauthenticated users
    const guestUserId = 'guest_home_user';
    testMessage.userId = guestUserId;
    console.log('🔍 [DEBUG] Using guest user ID for test message:', guestUserId);
  }
  
  console.log('🔍 [DEBUG] Preparing to send test message:', testMessage);
  console.log('🔍 [DEBUG] Message as JSON string:', JSON.stringify(testMessage));
  console.log('🔍 [DEBUG] Message byte length:', JSON.stringify(testMessage).length);
  
  try {
    ws.value.send(JSON.stringify(testMessage));
    console.log('🔍 [DEBUG] Message sent successfully');
    console.log('📤 Test message sent:', testMessage);
  } catch (error) {
    console.log('🔍 [DEBUG] Error sending message:', error);
    console.error('Failed to send message:', error);
  }
};

// Disconnect WebSocket
const disconnect = () => {
  console.log('🔍 [DEBUG] disconnect() called');
  console.log('🔍 [DEBUG] Current WebSocket instance:', ws.value);
  console.log('🔍 [DEBUG] Current readyState:', ws.value?.readyState);
  
  if (ws.value) {
    try {
      console.log('🔍 [DEBUG] Attempting to close WebSocket');
      ws.value.close(1000, 'User disconnected');
      console.log('🔍 [DEBUG] WebSocket close() called successfully');
    } catch (error) {
      console.log('🔍 [DEBUG] Error closing WebSocket:', error);
      console.error('Error closing WebSocket:', error);
    } finally {
      console.log('🔍 [DEBUG] Cleaning up WebSocket state');
      ws.value = null;
      isConnected.value = false;
      isConnecting.value = false;
      connectionStatus.value = 'disconnected';
      console.log('🔍 [DEBUG] WebSocket state cleaned up');
    }
  } else {
    console.log('🔍 [DEBUG] No WebSocket instance to disconnect');
  }
};

// Cleanup on unmount
onUnmounted(() => {
  if (ws.value) {
    try {
      ws.value.close();
    } catch (error) {
      console.error('Error closing WebSocket:', error);
    }
  }
});
</script>

<style scoped>
.websocket-test {
  max-width: 100%;
}
</style>
