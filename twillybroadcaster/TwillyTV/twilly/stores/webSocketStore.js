import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useWebSocketStore = defineStore('websocket', () => {
  const ws = ref(null); // WebSocket connection reference
  const statusMessage = ref('');
  const statusOnline = ref(false); // Track online/offline status
  const isConnected = ref(false); // Track WebSocket connection status
  const receivedMessages = ref([]); // Store received messages

  // Computed property for the number of received messages
  const messageCount = computed(() => receivedMessages.value.length);

  // Initialize and set up WebSocket connection
  const setupWebSocket = () => {
    ws.value = new WebSocket('wss://0t56fn3cml.execute-api.us-east-1.amazonaws.com/production/');

    ws.value.onopen = () => {
      console.log('WebSocket connection opened.');
      isConnected.value = true;
      statusMessage.value = 'Connected to WebSocket server.';
    };

    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error);
      statusMessage.value = 'WebSocket error. Check console for details.';
    };

    ws.value.onclose = (event) => {
      console.log('WebSocket connection closed. Code:', event.code, 'Reason:', event.reason);
      isConnected.value = false;
      statusMessage.value = `WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`;
    };

    ws.value.onmessage = (event) => {
      // Handle incoming messages
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'text') {
          console.log(message);
          // Keep the last 5 messages or adjust as needed
          receivedMessages.value.push(message.content);
          if (receivedMessages.value.length > 5) {
            receivedMessages.value.shift(); // Remove the oldest message if needed
          }
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  };

  // Publish a message to the WebSocket server
  const publishMessage = (content, targetType = 'defaultType') => {
    const message = {
      type: 'text',
      content: content || 'Default message content',
      targetType,
    };

    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message));
      console.log('Message sent:', message);
      statusMessage.value = 'Message published successfully!';
    } else {
      statusMessage.value = 'WebSocket is not open.';
    }
  };

  // Change the online/offline status and publish it to the WebSocket server
  const changeStatus = (online, statusTargetType = 'status') => {
    const message = {
      type: 'text',
      content: online ? 'Online' : 'Offline',
      targetType: statusTargetType,
    };

    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify(message));
      statusMessage.value = 'Status Change published';
    } else {
      statusMessage.value = 'WebSocket is not open.';
    }
  };

  // Close the WebSocket connection
  const closeWebSocket = () => {
    if (ws.value) {
      ws.value.close();
    }
  };

  return {
    ws,
    statusMessage,
    statusOnline,
    isConnected,
    receivedMessages,
    messageCount, // Added computed property
    setupWebSocket,
    publishMessage,
    changeStatus,
    closeWebSocket,
  };
});
