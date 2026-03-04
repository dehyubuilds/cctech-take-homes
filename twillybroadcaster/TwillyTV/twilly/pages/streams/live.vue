<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <!-- Live Stream Header -->
    <div class="sticky top-0 z-20 bg-black/80 backdrop-blur-sm border-b border-teal-500/30">
      <div class="max-w-7xl mx-auto px-4 py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span class="text-red-400 font-medium text-sm">LIVE</span>
            </div>
            <h1 class="text-white font-semibold text-lg">{{ streamTitle }}</h1>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-gray-300 text-sm">{{ viewerCount }} watching</span>
            <button @click="toggleFullscreen" class="p-2 text-gray-300 hover:text-white transition-colors">
              <Icon name="heroicons:arrows-pointing-out" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>

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
              >
                Your browser does not support the video tag.
              </video>
              
              <!-- Stream Overlay -->
              <div class="absolute top-4 left-4 flex items-center gap-2">
                <div class="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
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
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                </select>
              </div>
            </div>

            <!-- Stream Info -->
            <div class="p-6">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <h2 class="text-xl font-bold text-white mb-2">{{ streamTitle }}</h2>
                  <p class="text-gray-300 text-sm mb-3">{{ streamDescription }}</p>
                  <div class="flex items-center gap-4 text-sm text-gray-400">
                    <span>{{ formatDate(streamStartTime) }}</span>
                    <span>{{ viewerCount }} viewers</span>
                    <span>{{ formatDuration(streamDuration) }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button 
                    @click="toggleLike"
                    :class="isLiked ? 'text-red-500' : 'text-gray-400'"
                    class="p-2 hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <Icon name="heroicons:heart" class="w-5 h-5" />
                  </button>
                  <button 
                    @click="shareStream"
                    class="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <Icon name="heroicons:share" class="w-5 h-5" />
                  </button>
                </div>
              </div>

              <!-- Stream Actions -->
              <div class="flex items-center gap-4 pt-4 border-t border-gray-700">
                <button 
                  @click="toggleChat"
                  :class="showChat ? 'bg-teal-500 text-white' : 'bg-gray-700 text-gray-300'"
                  class="px-4 py-2 rounded-lg transition-colors"
                >
                  <Icon name="heroicons:chat-bubble-left-right" class="w-4 h-4 inline mr-2" />
                  Chat
                </button>
                <button 
                  @click="toggleNotifications"
                  :class="notificationsEnabled ? 'bg-teal-500 text-white' : 'bg-gray-700 text-gray-300'"
                  class="px-4 py-2 rounded-lg transition-colors"
                >
                  <Icon name="heroicons:bell" class="w-4 h-4 inline mr-2" />
                  Notifications
                </button>
                <button 
                  v-if="streamPrice > 0"
                  @click="purchaseAccess"
                  class="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                >
                  <Icon name="heroicons:credit-card" class="w-4 h-4 inline mr-2" />
                  Purchase Access (${{ streamPrice }})
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Chat Sidebar -->
        <div v-if="showChat" class="lg:col-span-1">
          <div class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 h-[600px] flex flex-col">
            <!-- Chat Header -->
            <div class="p-4 border-b border-gray-700">
              <h3 class="text-white font-semibold">Live Chat</h3>
              <p class="text-gray-400 text-sm">{{ chatMessages.length }} messages</p>
            </div>

            <!-- Chat Messages -->
            <div class="flex-1 overflow-y-auto p-4 space-y-3">
              <div v-for="message in chatMessages" :key="message.id" class="flex gap-3">
                <div class="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span class="text-white text-sm font-medium">{{ message.user.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-white text-sm font-medium">{{ message.user }}</span>
                    <span class="text-gray-400 text-xs">{{ formatTime(message.timestamp) }}</span>
                  </div>
                  <p class="text-gray-300 text-sm">{{ message.text }}</p>
                </div>
              </div>
            </div>

            <!-- Chat Input -->
            <div class="p-4 border-t border-gray-700">
              <form @submit.prevent="sendMessage" class="flex gap-2">
                <input
                  v-model="newMessage"
                  type="text"
                  placeholder="Type a message..."
                  class="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                />
                <button 
                  type="submit"
                  class="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                >
                  <Icon name="heroicons:paper-airplane" class="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <!-- Related Streams -->
      <div class="mt-8">
        <h3 class="text-xl font-bold text-white mb-4">Related Streams</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div v-for="stream in relatedStreams" :key="stream.id" 
               class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 overflow-hidden cursor-pointer hover:border-teal-500/50 transition-all duration-300"
               @click="navigateToStream(stream.id)"
          >
            <div class="relative aspect-video">
              <img :src="stream.thumbnail" :alt="stream.title" class="w-full h-full object-cover" />
              <div class="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                LIVE
              </div>
              <div class="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                {{ stream.viewerCount }} watching
              </div>
            </div>
            <div class="p-4">
              <h4 class="text-white font-medium mb-1 truncate">{{ stream.title }}</h4>
              <p class="text-gray-400 text-sm mb-2">{{ stream.creator }}</p>
              <div class="flex items-center justify-between text-xs text-gray-500">
                <span>{{ stream.category }}</span>
                <span>{{ formatDuration(stream.duration) }}</span>
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

const route = useRoute();
const videoPlayer = ref(null);

// Stream data
const streamTitle = ref('Dark Knights Live Event');
const streamDescription = ref('Join us for the epic Dark Knights live event featuring exclusive performances and behind-the-scenes content.');
const streamUrl = ref('https://your-cloudfront.net/events/current/playlist.m3u8');
const streamStartTime = ref(new Date());
const streamDuration = ref(3600); // 1 hour in seconds
const streamPrice = ref(9.99);
const viewerCount = ref(1247);
const currentTime = ref(0);

// Player state
const selectedQuality = ref('auto');
const isLiked = ref(false);
const showChat = ref(true);
const notificationsEnabled = ref(false);

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

// Related streams
const relatedStreams = ref([
  {
    id: 'stream2',
    title: 'Dark Knights Behind the Scenes',
    creator: 'DarkKnightEvents',
    category: 'Entertainment',
    thumbnail: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Behind+Scenes',
    viewerCount: 856,
    duration: 1800
  },
  {
    id: 'stream3',
    title: 'Exclusive Interview',
    creator: 'DarkKnightEvents',
    category: 'Interview',
    thumbnail: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Interview',
    viewerCount: 432,
    duration: 900
  }
]);

// Video player events
const onVideoLoad = () => {
  console.log('Video loaded');
};

const onTimeUpdate = () => {
  if (videoPlayer.value) {
    currentTime.value = videoPlayer.value.currentTime;
  }
};

const onStreamEnd = () => {
  console.log('Stream ended');
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

const toggleLike = () => {
  isLiked.value = !isLiked.value;
};

const shareStream = () => {
  const shareData = {
    title: streamTitle.value,
    text: streamDescription.value,
    url: window.location.href
  };
  
  if (navigator.share) {
    navigator.share(shareData);
  } else {
    navigator.clipboard.writeText(window.location.href);
    alert('Stream link copied to clipboard!');
  }
};

const toggleChat = () => {
  showChat.value = !showChat.value;
};

const toggleNotifications = () => {
  notificationsEnabled.value = !notificationsEnabled.value;
};

const purchaseAccess = () => {
  // Navigate to purchase page
  navigateTo(`/streams/purchase/${route.params.id || 'current'}`);
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

const navigateToStream = (streamId) => {
  navigateTo(`/streams/live/${streamId}`);
};

// Utility functions
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString();
};

const formatTime = (date) => {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Auto-increment viewer count
let viewerInterval;
onMounted(() => {
  viewerInterval = setInterval(() => {
    viewerCount.value += Math.floor(Math.random() * 3) - 1;
    if (viewerCount.value < 0) viewerCount.value = 0;
  }, 5000);
});

onUnmounted(() => {
  if (viewerInterval) {
    clearInterval(viewerInterval);
  }
});
</script>

<style scoped>
.aspect-video {
  aspect-ratio: 16 / 9;
}

.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}
</style> 