<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
    <!-- Header -->
    <div class="bg-black/50 backdrop-blur-sm border-b border-teal-500/30">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <button 
              @click="navigateTo('/')"
              class="text-white/70 hover:text-white transition-colors"
            >
              <Icon name="heroicons:arrow-left" class="w-6 h-6" />
            </button>
            <div>
              <h1 class="text-xl font-bold text-white">{{ streamTitle }}</h1>
              <p class="text-gray-400 text-sm">{{ streamDescription }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
              LIVE
            </div>
            <div class="text-gray-400 text-sm">{{ viewerCount }} watching</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Main Video Player -->
        <div class="lg:col-span-3">
          <div class="bg-black rounded-xl overflow-hidden">
            <!-- Video Player -->
            <div class="relative aspect-video bg-black">
              <video
                ref="videoPlayer"
                :src="streamUrl"
                class="w-full h-full"
                controls
                autoplay
                muted
                @loadedmetadata="onVideoLoad"
                @timeupdate="onTimeUpdate"
                @ended="onStreamEnd"
                @error="onVideoError"
              >
                Your browser does not support the video tag.
              </video>
              
              <!-- Stream Overlay -->
              <div class="absolute top-4 left-4 flex items-center gap-2">
                <div class="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium animate-pulse">
                  LIVE
                </div>
                <div class="bg-black/50 text-white px-2 py-1 rounded text-xs">
                  {{ formatDuration(currentTime) }}
                </div>
              </div>

              <!-- Quality Selector -->
              <div class="absolute top-4 right-4">
                <select 
                  v-model="selectedQuality"
                  @change="changeQuality"
                  class="bg-black/50 text-white px-3 py-1 rounded text-sm border border-gray-600"
                >
                  <option value="auto">Auto</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                  <option value="360p">360p</option>
                </select>
              </div>

              <!-- Loading Overlay -->
              <div v-if="isLoading" class="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div class="text-center">
                  <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400 mx-auto mb-4"></div>
                  <p class="text-white">Loading stream...</p>
                </div>
              </div>

              <!-- Error Overlay -->
              <div v-if="hasError" class="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div class="text-center">
                  <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 text-red-400 mx-auto mb-4" />
                  <p class="text-white mb-4">Stream not available</p>
                  <button 
                    @click="retryStream"
                    class="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>

            <!-- Stream Info -->
            <div class="p-6">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h2 class="text-2xl font-bold text-white mb-2">{{ streamTitle }}</h2>
                  <p class="text-gray-400 mb-4">{{ streamDescription }}</p>
                  <div class="flex items-center gap-4 text-sm text-gray-500">
                    <span>Started {{ formatTimeAgo(streamStartTime) }}</span>
                    <span>{{ viewerCount }} viewers</span>
                    <span>{{ streamCategory }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button 
                    @click="toggleLike"
                    class="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-600 hover:border-teal-500 transition-colors"
                    :class="isLiked ? 'bg-teal-500/20 border-teal-500' : 'bg-transparent'"
                  >
                    <Icon name="heroicons:heart" class="w-5 h-5" :class="isLiked ? 'text-red-500' : 'text-gray-400'" />
                    <span class="text-white">{{ likeCount }}</span>
                  </button>
                  <button 
                    @click="toggleFullscreen"
                    class="p-2 rounded-lg border border-gray-600 hover:border-teal-500 transition-colors"
                  >
                    <Icon name="heroicons:arrows-pointing-out" class="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Sidebar -->
        <div class="lg:col-span-1">
          <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 h-[600px] flex flex-col">
            <div class="p-4 border-b border-teal-500/30">
              <h3 class="text-lg font-semibold text-white">Live Chat</h3>
              <p class="text-gray-400 text-sm">{{ chatMessages.length }} messages</p>
            </div>
            
            <div class="flex-1 overflow-y-auto p-4 space-y-3">
              <div v-for="message in chatMessages" :key="message.id" class="flex gap-3">
                <div class="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span class="text-white text-xs font-bold">{{ message.user.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-white font-medium text-sm">{{ message.user }}</span>
                    <span class="text-gray-500 text-xs">{{ formatTimeAgo(message.timestamp) }}</span>
                  </div>
                  <p class="text-gray-300 text-sm">{{ message.text }}</p>
                </div>
              </div>
            </div>
            
            <div class="p-4 border-t border-teal-500/30">
              <div class="flex gap-2">
                <input
                  v-model="newMessage"
                  @keyup.enter="sendMessage"
                  type="text"
                  placeholder="Type a message..."
                  class="flex-1 bg-black/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none"
                />
                <button 
                  @click="sendMessage"
                  class="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import streamingConfig from '~/config/streaming.js';

const route = useRoute();
const videoPlayer = ref(null);

// Stream data
const streamId = route.params.id;
const streamTitle = ref('Dark Knights Live Event');
const streamDescription = ref('Join us for the epic Dark Knights live event featuring exclusive performances and behind-the-scenes content.');
const streamCategory = ref('Entertainment');
const streamStartTime = ref(new Date(Date.now() - 1800000)); // 30 minutes ago
const viewerCount = ref(1247);
const likeCount = ref(89);
const currentTime = ref(0);

// Player state
const selectedQuality = ref('auto');
const isLiked = ref(false);
const isLoading = ref(true);
const hasError = ref(false);

// Chat data
const chatMessages = ref([
  {
    id: 1,
    user: 'StreamFan123',
    text: 'This is amazing! 🔥',
    timestamp: new Date(Date.now() - 30000)
  },
  {
    id: 2,
    user: 'DarkKnightLover',
    text: 'Can\'t wait for the main event!',
    timestamp: new Date(Date.now() - 25000)
  },
  {
    id: 3,
    user: 'EventGoer',
    text: 'The production quality is incredible',
    timestamp: new Date(Date.now() - 20000)
  }
]);
const newMessage = ref('');

// Stream URL
const streamUrl = computed(() => {
  return `${streamingConfig.hls.baseUrl}/${streamId}/playlist.m3u8`;
});

// Video player events
const onVideoLoad = () => {
  console.log('Video loaded');
  isLoading.value = false;
  hasError.value = false;
};

const onTimeUpdate = () => {
  if (videoPlayer.value) {
    currentTime.value = videoPlayer.value.currentTime;
  }
};

const onStreamEnd = () => {
  console.log('Stream ended');
  hasError.value = true;
};

const onVideoError = (error) => {
  console.error('Video error:', error);
  isLoading.value = false;
  hasError.value = true;
};

// Player controls
const toggleFullscreen = () => {
  if (videoPlayer.value) {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoPlayer.value.requestFullscreen();
    }
  }
};

const changeQuality = () => {
  console.log('Quality changed to:', selectedQuality.value);
  // Implement quality switching logic
};

const retryStream = () => {
  isLoading.value = true;
  hasError.value = false;
  if (videoPlayer.value) {
    videoPlayer.value.load();
  }
};

// Chat functions
const sendMessage = () => {
  if (newMessage.value.trim()) {
    chatMessages.value.push({
      id: Date.now(),
      user: 'You',
      text: newMessage.value,
      timestamp: new Date()
    });
    newMessage.value = '';
  }
};

const toggleLike = () => {
  isLiked.value = !isLiked.value;
  likeCount.value += isLiked.value ? 1 : -1;
};

// Utility functions
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const formatTimeAgo = (date) => {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  
  if (hours > 0) {
    return `${hours}h ago`;
  }
  return `${minutes}m ago`;
};

// Simulate live updates
let updateInterval;

onMounted(() => {
  // Simulate viewer count updates
  updateInterval = setInterval(() => {
    viewerCount.value += Math.floor(Math.random() * 3) - 1;
    if (viewerCount.value < 1000) viewerCount.value = 1000;
  }, 5000);
});

onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});
</script>

<style scoped>
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .5;
  }
}
</style> 