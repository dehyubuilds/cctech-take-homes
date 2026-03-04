<template>
  <div>
    <!-- Announcement Box for text messages -->
    <div v-if="statusMessage" class="announcement-box">
      {{ statusMessage }}
    </div>

    <!-- Display the latest message with animation -->
    <transition name="slide-up" @before-enter="beforeEnter" @enter="enter" @leave="leave">
      <div v-if="latestMessage" class="latest-message">
        <!-- Check the type of content and render accordingly -->
        <template v-if="isImage(latestMessage.content)">
          <div class="tv-display">
            <img :src="latestMessage.content" alt="Image content" class="tv-content"/>
          </div>
        </template>
        <template v-else-if="isVideo(latestMessage.content)">
          <div class="tv-display">
            <video 
              ref="videoElement" 
              :src="latestMessage.content" 
              controls 
              class="tv-content"
              @play="resetPlayback"
            ></video>
          </div>
        </template>
        <template v-else>
          <div class="announcement-box">
            {{ latestMessage.content }}
          </div>
        </template>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const statusMessage = ref('');
const latestMessage = ref(null);
const videoElement = ref(null); // Define a ref for the video element
let ws;

const setupWebSocket = () => {
  ws = new WebSocket('wss://0t56fn3cml.execute-api.us-east-1.amazonaws.com/production/');

  ws.onopen = () => {
    console.log('WebSocket connection opened.');
    statusMessage.value = '';

    const subscribeMessage = {
      type: 'subscribe',
      targetType: 'series'
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

const resetPlayback = () => {
  if (videoElement.value) {
    videoElement.value.currentTime = 0; // Reset time to the beginning
  }
};

const beforeEnter = (el) => {
  el.style.transform = 'translateY(100%)';
  el.style.opacity = '0';
};

const enter = (el, done) => {
  el.offsetHeight; // Trigger a reflow to apply the starting styles
  el.style.transition = 'transform 0.5s ease-out, opacity 0.5s ease-out';
  el.style.transform = 'translateY(0)';
  el.style.opacity = '1';
  done();
};

const leave = (el, done) => {
  el.style.transition = 'transform 0.5s ease-in, opacity 0.5s ease-in';
  el.style.transform = 'translateY(100%)';
  el.style.opacity = '0';
  done();
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
/* Style for the announcement box (text content) */
.announcement-box {
  margin-top: 20px;
  padding: 15px;
  background-color: black; /* Dark background for contrast */
  border: 2px solid #ffcc00; /* Blue border for prominence */
  border-radius: 10px; /* Rounded corners for a modern look */
  color: #fff; /* White text for readability */
  font-size: 1.5rem; /* Larger font size for visibility */
  font-weight: bold; /* Bold text for emphasis */
  box-shadow: 0 4px 8px rgba(0,0,0,0.2); /* Shadow for a more prominent effect */
  text-align: center; /* Center the text */
  max-width: 90%; /* Restrict the width to 90% of the page width */
  margin: 20px auto; /* Center horizontally with margin */
  position: relative; /* To enable absolute positioning of potential icons or elements */
}

/* Style for the TV display (media content) */
.tv-display {
  position: relative;
  margin: 20px auto;
  border: 5px solid #f0f0f0; /* Light border to frame the advertisement */
  border-radius: 10px; /* Rounded corners for a modern look */
  overflow: hidden;
  max-width: 100%; /* Full width */
  background-color: #000; /* Black background to resemble a TV screen */
  box-shadow: 0 6px 12px rgba(0,0,0,0.4); /* Enhanced shadow for emphasis */
}

/* Style for media content (images and videos) inside the TV display */
.tv-content {
  width: 100%;
  height: 100%;
  object-fit: cover; /* Cover the box while maintaining aspect ratio */
  display: block;
}

/* Add overlay for advertisement text or branding */
.tv-display::before {
  content: 'ADVERTISEMENT';
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7); /* Semi-transparent background for contrast */
  color: #fff; /* White text for readability */
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 1rem; /* Size of the overlay text */
  font-weight: bold; /* Bold text for emphasis */
}

/* Style for the close button */
.tv-display .close-button {
  background: #ff5a5f; /* Red background for close button */
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  position: absolute;
  top: 10px;
  right: 10px;
}

/* Animation styles for sliding up */
.slide-up-enter-active, .slide-up-leave-active {
  transition: transform 0.5s ease, opacity 0.5s ease;
}
.slide-up-enter, .slide-up-leave-to /* .slide-up-leave-active in <2.1.8 */ {
  transform: translateY(100%);
  opacity: 0;
}

img.tv-content {
  max-height: 250px; /* Limit image height */
  object-fit: cover; 
}

video.tv-content {
  max-height: 300px; /* Limit video height */
  object-fit: cover; /* Cover the box while maintaining aspect ratio */
}
</style>
