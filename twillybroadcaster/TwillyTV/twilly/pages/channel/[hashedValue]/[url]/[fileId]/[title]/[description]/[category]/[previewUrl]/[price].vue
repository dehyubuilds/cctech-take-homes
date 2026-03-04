<template>
  <div class="channel-guide bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen">
    <section class="channel-guide-content max-w-6xl mx-auto px-4 py-8">
      <div class="channel-guide-item bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-gray-700/50">
        <!-- Loading Indicator -->
        <div v-if="isLoading" class="loading-indicator flex justify-center p-12">
          <div class="relative">
            <div class="animate-spin rounded-full h-16 w-16 border-4 border-gray-600 border-t-blue-500"></div>
            <div class="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-blue-400 opacity-20"></div>
          </div>
        </div>
        <div v-else>
          <!-- Display for Video Content -->
          <div v-if="isVideo" class="show-preview">
            <!-- Enhanced Header -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h2 class="channel-guide-title text-3xl md:text-4xl font-bold text-white mb-2">
                    {{ titleWithPrice }}
                  </h2>
                  <p class="show-description text-gray-300 text-lg">
                    <span class="text-red-400">{{ description }}</span>
                  </p>
                </div>
                <div class="flex items-center gap-4">
                  <!-- Live Indicator -->
                  <div v-if="isLiveStream" class="flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-full px-4 py-2">
                    <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span class="text-red-400 font-semibold text-sm">LIVE</span>
                  </div>
                  <!-- Creator Info -->
                  <div class="flex items-center gap-3 bg-gray-700/50 rounded-xl p-3">
                    <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <Icon name="heroicons:user" class="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p class="text-white text-sm font-medium">Creator</p>
                      <p class="text-gray-400 text-xs">Collaborative Stream</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Enhanced Video Preview Section -->
            <div class="video-preview mb-8">
              <div class="video-container relative mx-auto group">
                <!-- Enhanced Video Player -->
                <video
                  v-if="!isLoading"
                  ref="videoRef"
                  :src="reconstructedUrl"
                  :controls="false"
                  :playsinline="true"
                  @play="onPlay"
                  @pause="onPause"
                  @ended="onEnded"
                  @loadedmetadata="onLoadedMetadata"
                  @timeupdate="onTimeUpdate"
                  @volumechange="onVolumeChange"
                  class="video-player w-full rounded-2xl shadow-2xl border border-gray-700/50"
                >
                  Your browser does not support the video element.
                </video>

                <!-- Enhanced Cover Art Overlay -->
                <div
                  v-if="!videoPlaying && previewUrl && !isLoading"
                  class="cover-art-overlay absolute inset-0 bg-black/60 backdrop-blur-sm rounded-2xl overflow-hidden cursor-pointer group-hover:bg-black/40 transition-all duration-300"
                  @click="handlePreviewClick"
                >
                  <img 
                    :src="previewUrl" 
                    alt="Cover Art" 
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                </div>

                <!-- Enhanced Play Button Overlay -->
                <div
                  v-if="!videoPlaying && !isLoading"
                  class="play-button absolute inset-0 flex items-center justify-center cursor-pointer"
                  @click="handlePreviewClick"
                >
                  <div class="play-icon bg-white/90 backdrop-blur-sm rounded-full p-6 transform transition-all duration-300 hover:scale-110 hover:bg-white shadow-2xl">
                    <Icon name="heroicons:play" class="w-8 h-8 text-gray-900" />
                  </div>
                </div>

                <!-- Enhanced Video Controls Overlay -->
                <div
                  v-if="videoPlaying"
                  class="video-controls-overlay absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  <div class="flex items-center justify-between">
                    <!-- Progress Bar -->
                    <div class="flex-1 mx-4">
                      <div class="relative">
                        <div class="w-full bg-gray-600/50 rounded-full h-2">
                          <div 
                            class="bg-blue-500 h-2 rounded-full transition-all duration-100"
                            :style="{ width: `${progressPercent}%` }"
                          ></div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          :value="progressPercent"
                          @input="seekVideo"
                          class="absolute inset-0 w-full opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>
                    
                    <!-- Time Display -->
                    <div class="text-white text-sm font-mono">
                      {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
                    </div>
                    
                    <!-- Control Buttons -->
                    <div class="flex items-center gap-3">
                      <button @click="togglePlay" class="control-btn">
                        <Icon :name="videoPlaying ? 'heroicons:pause' : 'heroicons:play'" class="w-5 h-5" />
                      </button>
                      <button @click="toggleMute" class="control-btn">
                        <Icon :name="isMuted ? 'heroicons:speaker-x-mark' : 'heroicons:speaker-wave'" class="w-5 h-5" />
                      </button>
                      <div class="relative">
                        <button @click="toggleVolumeSlider" class="control-btn">
                          <Icon name="heroicons:speaker-wave" class="w-5 h-5" />
                        </button>
                        <div v-if="showVolumeSlider" class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            :value="volume * 100"
                            @input="setVolume"
                            class="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                          />
                        </div>
                      </div>
                      <button @click="toggleFullscreen" class="control-btn">
                        <Icon name="heroicons:arrows-pointing-out" class="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Collaborative Features Overlay -->
                <div class="collaborative-overlay absolute top-4 right-4 flex flex-col gap-3 z-10">
                  <!-- Live Reactions -->
                  <div class="flex flex-col gap-2">
                    <button 
                      v-for="(emoji, action) in reactions" 
                      :key="action"
                      @click="sendReaction(action)"
                      class="reaction-btn bg-black/60 backdrop-blur-sm border border-white/20 rounded-full p-3 hover:bg-white/20 transition-all duration-200 hover:scale-110"
                    >
                      <span class="text-xl">{{ emoji }}</span>
                    </button>
                  </div>
                  
                  <!-- Collaborative Stream Button -->
                  <button 
                    @click="joinCollaborativeStream"
                    class="collab-btn bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
                  >
                    <Icon name="heroicons:user-group" class="w-4 h-4 inline-block mr-1" />
                    Join Stream
                  </button>
                </div>
              </div>
            </div>

            <!-- Enhanced Interactive Section -->
            <div class="interactive-section grid grid-cols-1 lg:grid-cols-3 gap-6">
              <!-- Live Chat Section -->
              <div class="lg:col-span-2">
                <div class="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
                  <div class="flex items-center gap-3 mb-4">
                    <div class="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                      <Icon name="heroicons:chat-bubble-left-right" class="w-4 h-4 text-white" />
                    </div>
                    <h3 class="text-lg font-semibold text-white">Live Chat</h3>
                    <span class="text-green-400 text-sm font-medium">Live</span>
                  </div>
                  
                  <!-- Chat Messages -->
                  <div class="chat-messages h-64 overflow-y-auto mb-4 space-y-3">
                    <div v-for="(message, index) in chatMessages" :key="index" class="flex items-start gap-3">
                      <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Icon name="heroicons:user" class="w-4 h-4 text-white" />
                      </div>
                      <div class="bg-gray-700/50 rounded-xl p-3 max-w-xs">
                        <p class="text-white text-sm">{{ message.text }}</p>
                        <p class="text-gray-400 text-xs mt-1">{{ message.time }}</p>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Chat Input -->
                  <div class="flex items-center gap-3">
                    <input
                      v-model="newChatMessage"
                      type="text"
                      placeholder="Join the conversation..."
                      class="flex-1 bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
                      @keyup.enter="sendChatMessage"
                    />
                    <button
                      @click="sendChatMessage"
                      :disabled="!newChatMessage.trim()"
                      class="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-3 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon name="heroicons:paper-airplane" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Collaborative Features Panel -->
              <div class="space-y-4">
                <!-- Creator Collaboration -->
                <div class="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
                  <div class="flex items-center gap-3 mb-4">
                    <div class="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                      <Icon name="heroicons:user-group" class="w-4 h-4 text-white" />
                    </div>
                    <h3 class="text-lg font-semibold text-white">Collaboration</h3>
                  </div>
                  
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-gray-300 text-sm">Active Creators</span>
                      <span class="text-white font-semibold">3</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-300 text-sm">Viewers</span>
                      <span class="text-white font-semibold">1.2k</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-300 text-sm">Reactions</span>
                      <span class="text-white font-semibold">847</span>
                    </div>
                  </div>
                  
                  <button
                    @click="joinAsCreator"
                    class="w-full mt-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-300"
                  >
                    <Icon name="heroicons:video-camera" class="w-4 h-4 inline-block mr-2" />
                    Join as Creator
                  </button>
                </div>
                
                <!-- Stream Stats -->
                <div class="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
                  <div class="flex items-center gap-3 mb-4">
                    <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                      <Icon name="heroicons:chart-bar" class="w-4 h-4 text-white" />
                    </div>
                    <h3 class="text-lg font-semibold text-white">Stream Stats</h3>
                  </div>
                  
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-gray-300 text-sm">Watch Time</span>
                      <span class="text-white font-semibold">24:32</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-300 text-sm">Peak Viewers</span>
                      <span class="text-white font-semibold">2.1k</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-300 text-sm">Engagement</span>
                      <span class="text-white font-semibold">94%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Display for PDF Content -->
          <div v-else-if="isPDF" class="pdf-viewer h-screen">
            <WebViewer 
              :path="`${publicPath}webviewer`" 
              :url="reconstructedUrl" 
              class="w-full h-full"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Payment Popup -->
    <div 
      v-if="showPaymentPopup" 
      class="payment-popup fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div class="popup-content bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 border border-gray-700/50">
        <div class="popup-scrollable-content p-6">
          <div class="stripe-container">
    
          </div>
        </div>
        <div class="popup-footer border-t border-gray-700 p-4">
          <button 
            @click="closePopup"
            class="close-button bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>

import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";


const route = useRoute();
const publicPath = useRuntimeConfig().publicPath || '/';


const isLoading = ref(true);
const showPaymentPopup = ref(false);
const videoPlaying = ref(false);
const showCommentBox = ref(false);

// Enhanced video player controls
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(1);
const isMuted = ref(false);
const showVolumeSlider = ref(false);
const progressPercent = ref(0);

// Collaborative features
const isLiveStream = ref(false);
const newChatMessage = ref('');
const chatMessages = ref([
  { text: "Amazing content! 🔥", time: "2 min ago" },
  { text: "Can't wait for the next episode!", time: "1 min ago" },
  { text: "This is so good! 👏", time: "Just now" }
]);

const reconstructedUrl = ref("");
const title = ref(route.params.title);
const description = ref(route.params.description);
const price = ref(route.params.price);
const category = ref(route.params.category);

const url = ref(route.params.url);
const previewUrl = ref(route.params.previewUrl);

const isVideo = computed(() => category.value === "Video");
const isPDF = computed(() => category.value === "Docs");


const isPaidContent = computed(() => {
  return (
    price.value &&
    price.value !== "0.00" &&
    price.value !== "0" &&
    price.value !== "Free" &&
    price.value !== "0-00"
  );
});

const formattedPrice = computed(() => {
  if (
    price.value === "0.00" ||
    price.value === "0" ||
    price.value === "Free" ||
    price.value === "0-00"
  ) {
    return "Free";
  } else {
    return `$${price.value}`;
  }
});

const titleWithPrice = computed(() => {
  return isPaidContent.value ? `🔒${title.value}` : title.value;
});

const videoRef = ref(null);

function closePopup() {
  showPaymentPopup.value = false;
}

function handlePreviewClick() {
  const video = videoRef.value;
  if (video) {
    if (videoPlaying.value) {
      video.pause();
    } else {
      // Ensure video plays inline
      video.playsInline = true;
      video.play().catch(error => {
        console.error('Error playing video:', error);
      });
    }
  }
}

function onPlay() {
  videoPlaying.value = true;
}

function onPause() {
  videoPlaying.value = false;
}

function onEnded() {
  videoPlaying.value = false;
}

function onLoadedMetadata() {
  isLoading.value = false;
  const video = videoRef.value;
  if (video) {
    duration.value = video.duration;
  }
}

function onTimeUpdate() {
  const video = videoRef.value;
  if (video) {
    currentTime.value = video.currentTime;
    progressPercent.value = (video.currentTime / video.duration) * 100;
  }
}

function onVolumeChange() {
  const video = videoRef.value;
  if (video) {
    volume.value = video.volume;
    isMuted.value = video.muted;
  }
}

function togglePlay() {
  const video = videoRef.value;
  if (video) {
    if (videoPlaying.value) {
      video.pause();
    } else {
      // Ensure video plays inline
      video.playsInline = true;
      video.play().catch(error => {
        console.error('Error playing video:', error);
      });
    }
  }
}

function toggleMute() {
  const video = videoRef.value;
  if (video) {
    video.muted = !video.muted;
    isMuted.value = video.muted;
  }
}

function toggleVolumeSlider() {
  showVolumeSlider.value = !showVolumeSlider.value;
}

function setVolume(event) {
  const video = videoRef.value;
  if (video) {
    const newVolume = event.target.value / 100;
    video.volume = newVolume;
    volume.value = newVolume;
    if (newVolume === 0) {
      video.muted = true;
      isMuted.value = true;
    } else {
      video.muted = false;
      isMuted.value = false;
    }
  }
}

function seekVideo(event) {
  const video = videoRef.value;
  if (video) {
    const seekTime = (event.target.value / 100) * video.duration;
    video.currentTime = seekTime;
  }
}

function toggleFullscreen() {
  const video = videoRef.value;
  if (video) {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function sendFiya() {
  console.log("🔥 sent!");
}

function sendHeart() {
  console.log("❤️ sent!");
}

function sendHeartEyes() {
  console.log("😍 sent!");
}

function sendThumbsUp() {
  console.log("👍 sent!");
}

function submitComment() {
  console.log("Comment submitted!");
}

function toggleCommentBox() {
  showCommentBox.value = !showCommentBox.value;
}

// New collaborative functions
function sendChatMessage() {
  if (newChatMessage.value.trim()) {
    const message = {
      text: newChatMessage.value,
      time: 'Just now'
    };
    chatMessages.value.push(message);
    newChatMessage.value = '';
    console.log('Chat message sent:', message);
  }
}

function joinCollaborativeStream() {
  console.log('Joining collaborative stream');
  // Here you would implement the logic to join as a collaborator
}

function joinAsCreator() {
  console.log('Joining as creator');
  // Here you would implement the logic to join as a creator
}

onMounted(() => {
  title.value = decodeURIComponent(route.params.title);
  description.value = decodeURIComponent(route.params.description);
  price.value = route.params.price;
  category.value = route.params.category;
  previewUrl.value = route.params.previewUrl;

  reconstructedUrl.value = url.value;
  

  isLoading.value = false;
});

useHead(() => {
  return {
    title: titleWithPrice.value,
    meta: [
      { hid: "og:title", property: "og:title", content: titleWithPrice.value },
      { hid: "og:url", property: "og:url", content: "" },
      { hid: "og:site_name", property: "og:site_name", content: "Twilly" },
      {
        hid: "og:description",
        property: "og:description",
        content: description.value,
      },
      { hid: "og:image", property: "og:image", content: previewUrl.value },
      { hid: "og:image:width", property: "og:image:width", content: "1280" },
      { hid: "og:image:height", property: "og:image:height", content: "720" },
      { hid: "og:type", property: "og:type", content: "video/mp4" },
      { hid: "twitter:url", name: "twitter:url", content: url.value },
      {
        hid: "twitter:description",
        name: "twitter:description",
        content: description.value,
      },
      {
        hid: "twitter:title",
        name: "twitter:title",
        content: titleWithPrice.value,
      },
      {
        hid: "twitter:image",
        name: "twitter:image",
        content: previewUrl.value,
      },
    ],
  };
});

// Add reactions object for emoji buttons
const reactions = {
  fiya: '🔥',
  heart: '❤️',
  heartEyes: '😍',
  thumbsUp: '👍'
};

const sendReaction = (type) => {
  switch(type) {
    case 'fiya': sendFiya(); break;
    case 'heart': sendHeart(); break;
    case 'heartEyes': sendHeartEyes(); break;
    case 'thumbsUp': sendThumbsUp(); break;
  }
};
</script>

<style scoped>
/* Base Channel Styles */
.channel-guide {
  @apply bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white;
}

.channel-guide-content {
  @apply max-w-6xl mx-auto px-4 py-8;
}

.channel-guide-item {
  @apply bg-gray-800/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-gray-700/50;
}

/* Title and Description */
.channel-guide-title {
  @apply text-3xl md:text-4xl font-bold text-white mb-2;
  background: linear-gradient(to right, #fff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.show-description {
  @apply text-gray-300 text-lg;
}

/* Media Container Styles */
.video-preview, .audio-preview, .image-preview {
  @apply mb-8 relative;
}

.video-container, .audio-container, .image-container {
  @apply relative mx-auto rounded-2xl overflow-hidden
         shadow-2xl border border-gray-700/50;
}

/* Enhanced Video Controls */
.video-controls-overlay {
  @apply absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4;
}

.control-btn {
  @apply bg-black/60 backdrop-blur-sm border border-white/20 text-white rounded-full p-2
         hover:bg-white/20 transition-all duration-200 hover:scale-110 focus:outline-none
         focus:ring-2 focus:ring-blue-500;
}

.reaction-btn {
  @apply bg-black/60 backdrop-blur-sm border border-white/20 rounded-full p-3 
         hover:bg-white/20 transition-all duration-200 hover:scale-110;
}

.collab-btn {
  @apply bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 
         text-white px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 
         hover:scale-105 shadow-lg;
}

/* Chat Styles */
.chat-messages {
  @apply h-64 overflow-y-auto mb-4 space-y-3;
}

.chat-messages::-webkit-scrollbar {
  @apply w-2;
}

.chat-messages::-webkit-scrollbar-track {
  @apply bg-gray-700/30 rounded-full;
}

.chat-messages::-webkit-scrollbar-thumb {
  @apply bg-gray-600/50 rounded-full hover:bg-gray-500/50;
}

/* Volume Slider */
.slider {
  @apply appearance-none bg-gray-600 rounded-lg cursor-pointer;
}

.slider::-webkit-slider-thumb {
  @apply appearance-none w-4 h-4 bg-blue-500 rounded-full cursor-pointer;
}

.slider::-moz-range-thumb {
  @apply w-4 h-4 bg-blue-500 rounded-full cursor-pointer border-none;
}

/* Interactive Section */
.interactive-section {
  @apply grid grid-cols-1 lg:grid-cols-3 gap-6;
}

/* Loading States */
.loading-indicator {
  @apply flex justify-center items-center p-12;
}

.loading-spinner {
  @apply animate-spin rounded-full h-16 w-16 border-4 border-gray-600 border-t-blue-500;
}

/* Payment Modal */
.payment-popup {
  @apply fixed inset-0 bg-black/75 backdrop-blur-sm 
         flex items-center justify-center z-50;
}

.popup-content {
  @apply bg-gray-800 rounded-2xl shadow-2xl
         max-w-lg w-full mx-4 border border-gray-700/50;
}

/* Responsive Design */
@media (max-width: 640px) {
  .channel-guide-content {
    @apply px-2;
  }

  .video-container, .audio-container, .image-container {
    @apply w-full;
  }

  .video-controls-overlay {
    @apply opacity-100;
  }

  .collaborative-overlay {
    @apply top-2 right-2;
  }

  .reaction-btn {
    @apply p-2;
  }

  .collab-btn {
    @apply px-3 py-1 text-xs;
  }
}

@media (min-width: 641px) and (max-width: 1024px) {
  .channel-guide-content {
    @apply px-4;
  }

  .video-container, .audio-container, .image-container {
    @apply w-11/12;
  }
}

@media (min-width: 1025px) {
  .channel-guide-content {
    @apply px-6;
  }

  .video-container, .audio-container, .image-container {
    @apply w-4/5;
  }
}

/* Hover Effects */
.video-container:hover .video-controls-overlay {
  @apply opacity-100;
}

.group:hover .play-icon {
  @apply scale-110;
}

/* Animations */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Focus States */
.control-btn:focus {
  @apply ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-800;
}

/* Custom Scrollbar for Chat */
.chat-messages {
  scrollbar-width: thin;
  scrollbar-color: rgb(75 85 99 / 0.5) transparent;
}
</style>
