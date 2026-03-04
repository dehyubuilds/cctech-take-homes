<template>
  <div>
    <!-- Status message styled like an ad box -->
    <div v-if="statusMessage" class="status-message">
      {{ statusMessage }}
    </div>

    <!-- Display the latest message -->
    <div v-if="latestMessage">
      <!-- Check the type of content and render accordingly -->
      <template v-if="isImage(latestMessage.content)">
        <div class="media-box">
          <img :src="latestMessage.content" alt="Image content" class="media-content"/>
        </div>
      </template>
      <template v-else-if="isVideo(latestMessage.content)">
        <div class="media-box">
          <video :src="latestMessage.content" controls class="media-content"></video>
        </div>
      </template>
      <template v-else>
        <div class="shoutout">{{ latestMessage.content }}</div>
      </template>
    </div>
  </div>
</template>


<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const statusMessage = ref('');
const latestMessage = ref(null);
let ws;

const setupWebSocket = () => {
  ws = new WebSocket('wss://0t56fn3cml.execute-api.us-east-1.amazonaws.com/production/');

  ws.onopen = () => {
    console.log('WebSocket connection opened.');
    statusMessage.value = '';

    const subscribeMessage = {
      type: 'subscribe',
      targetType: 'ads'
    };
    ws.send(JSON.stringify(subscribeMessage));
  };

  ws.onmessage = (event) => {
    const rawMessage = event.data;
    console.log('Raw message received:', rawMessage);

    if (rawMessage.startsWith('{') || rawMessage.startsWith('[')) {
      try {
        const parsedMessage = JSON.parse(rawMessage);
        latestMessage.value = parsedMessage; // Overwrite with the latest message
      } catch (error) {
        console.error('Error parsing JSON message:', error);
      }
    } else {
      console.log('Non-JSON message received:', rawMessage);
      if (rawMessage === 'Subscription updated') {
        statusMessage.value = '';
      }
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    statusMessage.value = '';
  };

  ws.onclose = (event) => {
    console.log('WebSocket connection closed. Code:', event.code, 'Reason:', event.reason);
    statusMessage.value = '';
  };
};

const isImage = (url) => {
  return url.match(/\.(jpeg|jpg|gif|png|webp|bmp|tiff|svg)$/i) !== null;
};

const isVideo = (url) => {
  return url.match(/\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv|mpeg|mpg|m3u8)$/i) !== null;
};

onMounted(() => {
  setupWebSocket();
});

onUnmounted(() => {
  if (ws) {
    ws.close();
  }
});
</script>


<style scoped>
.status-message {
  margin-top: 10px;
  padding: 10px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 5px;
  color: #333;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.media-box {
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 5px;
  overflow: hidden;
  max-width: 400px; /* Maximum width for media */
  margin-left: auto; /* Center the media box */
  margin-right: auto; /* Center the media box */
}

.media-content {
  width: 100%;
  height: auto; /* Maintain aspect ratio */
  display: block;
}

img.media-content {
  max-height: 300px; /* Limit image height */
  object-fit: cover; /* Cover the box while maintaining aspect ratio */
}

video.media-content {
  max-height: 300px; /* Limit video height */
  object-fit: cover; /* Cover the box while maintaining aspect ratio */
}

.shoutout {
  padding: 20px;
  background-color: #d4edda;
  border: 2px solid #c3e6cb;
  border-radius: 8px;
  color: #155724;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  text-align: center;
  font-size: 1.25rem; /* Larger font size for visibility */
  max-width: 80%; /* Restrict the width to 80% of the page width */
  margin: 20px auto; /* Center horizontally with margin */
}
</style>


