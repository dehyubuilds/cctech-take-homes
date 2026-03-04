import { defineStore } from "pinia";
import { ref, nextTick } from "vue";

export const useMediaSocketStore = defineStore("mediaSocketStore", () => {
  const fire = ref(null);
  const isOffline = ref(false);
  let ws;
  let statusWs;

  // WebSocket setup functions
  const setupFireWebSocket = () => {
    if (ws && ws.readyState === WebSocket.OPEN) return; // Prevent multiple connections

    ws = new WebSocket(
      "wss://0t56fn3cml.execute-api.us-east-1.amazonaws.com/production/"
    );

    ws.onopen = () => {
      console.log("WebSocket connection opened.");
      ws.send(JSON.stringify({ type: "subscribe", targetType: "fire" }));
    };

    ws.onmessage = (event) => {
      const rawMessage = event.data;
      if (rawMessage.startsWith("{") || rawMessage.startsWith("[")) {
        try {
          const parsedMessage = JSON.parse(rawMessage);
          if (parsedMessage.content === "🔥") resetFire();
        } catch (error) {
          console.error("Error parsing JSON message:", error);
        }
      }
    };

    ws.onerror = (error) => console.error("WebSocket error:", error);
    ws.onclose = (event) => {
      console.log(
        "WebSocket connection closed. Code:",
        event.code,
        "Reason:",
        event.reason
      );
      ws = null; // Clear the connection
    };
  };

  const setupStatusWebSocket = () => {
    if (statusWs && statusWs.readyState === WebSocket.OPEN) return; // Prevent multiple connections

    statusWs = new WebSocket(
      "wss://0t56fn3cml.execute-api.us-east-1.amazonaws.com/production/"
    );

    statusWs.onopen = () => {
      console.log("Status WebSocket connection opened.");
      statusWs.send(JSON.stringify({ type: "subscribe", targetType: "status" }));
    };

    statusWs.onmessage = (event) => {
      const rawMessage = event.data;
      if (rawMessage.startsWith("{") || rawMessage.startsWith("[")) {
        try {
          const parsedMessage = JSON.parse(rawMessage);
          isOffline.value = parsedMessage.content === "Offline";
        } catch (error) {
          console.error("Error parsing JSON message:", error);
        }
      }
    };

    statusWs.onerror = (error) => console.error("WebSocket error:", error);
    statusWs.onclose = (event) => {
      console.log(
        "WebSocket connection closed. Code:",
        event.code,
        "Reason:",
        event.reason
      );
      statusWs = null; // Clear the connection
    };
  };

  // Reset functions
  const resetFire = () => {
    fire.value = null;
    nextTick(() => (fire.value = "🔥"));
  };

  function sendFire() {
    resetFire();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'reaction', emoji: '🔥' }));
    }
  }
  
  function sendHeart() {
    resetHeart();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'reaction', emoji: '❤️' }));
    }
  }
  
  function sendHeartEyes() {
    resetHeartEyes();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'reaction', emoji: '😍' }));
    }
  }
  
  function sendThumbsUp() {
    resetThumbsUp();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'reaction', emoji: '👍' }));
    }
  }

})