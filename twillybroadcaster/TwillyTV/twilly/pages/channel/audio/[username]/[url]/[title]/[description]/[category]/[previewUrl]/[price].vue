<template>
  <div class="channel-guide">
    <section class="channel-guide-content">
      <div class="channel-guide-item">
        <!-- Loading Indicator -->
        <div v-if="isLoading" class="loading-indicator"></div>

        <!-- Content Display -->
        <div v-else>
          <!-- Display for Audio Content -->
          <div v-if="isAudio" class="show-preview">
            <h2 class="channel-guide-title">{{ titleWithPrice }}</h2>
            <p class="show-description">
              <span class="red-text">{{ description }}</span>
            </p>

            <!-- Audio Preview Section -->
            <div class="audio-preview">
              <!-- Image Preview with Overlay -->
              <div class="image-container">
                <img
                  v-if="previewUrl"
                  :src="previewUrl"
                  alt="Audio Cover"
                  class="file-image"
                  @click="handlePreviewClick"
                />
                <div v-else class="no-preview">
                  <p>No preview available</p>
                </div>

                <!-- Play Button Overlay -->
                <div
                  class="play-button"
                  v-if="audioPlaying"
                  @click="handlePreviewClick"
                >
                  <span class="play-text">Pause</span>
                </div>
              </div>

              <!-- Audio Player Controls -->
              <div class="audio-controls" :class="{ 'show-controls': showControls }">
                <button class="control-button rewind" @click="rewindTrack">⏪</button>
                <button class="control-button play-pause" @click="handlePreviewClick">
                  {{ audioPlaying ? '❚❚' : '▶️' }}
                </button>
                <button class="control-button forward" @click="forwardTrack">⏩</button>
              </div>
              
              <!-- Audio Player -->
              <audio
                ref="audioRef"
                :src="reconstructedUrl"
                controls
                @play="onPlay"
                @pause="onPause"
                @ended="onEnded"
                class="audio-player"
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Payment Popup -->
    <div v-if="showPaymentPopup" class="payment-popup">
      <div class="popup-content">
        <div class="popup-scrollable-content">
          <div class="stripe-container">
    
          </div>
        </div>
        <div class="close-button">
          <button @click="closePopup">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>

import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";

const cloudFrontBaseUrl = 'https://d4idc5cmwxlpy.cloudfront.net';

function replaceS3WithCloudFront(url) {
  return url ? url.replace('https://theprivatecollection.s3.us-east-2.amazonaws.com', cloudFrontBaseUrl) : url;
}

const route = useRoute();

const isLoading = ref(true);
const showPaymentPopup = ref(false);
const audioPlaying = ref(false);
const showControls = ref(false);
const controlsTimeout = ref(null);

const reconstructedUrl = ref("");
const title = ref(route.params.title);
const description = ref(route.params.description);
const price = ref(route.params.price);
const category = ref(route.params.category);

const url = ref(route.params.url);
const previewUrl = ref(route.params.previewUrl);

reconstructedUrl.value = replaceS3WithCloudFront(url.value);
previewUrl.value = replaceS3WithCloudFront(previewUrl.value);

const isAudio = computed(() => category.value === "Audio");

const isPaidContent = computed(() => {
  return price.value && !["0.00", "0", "Free", "0-00"].includes(price.value);
});

const formattedPrice = computed(() => isPaidContent.value ? `$${price.value}` : "Free");

const titleWithPrice = computed(() => isPaidContent.value ? `🔒${title.value}` : title.value);

const audioRef = ref(null);

function closePopup() {
  showPaymentPopup.value = false;
}

function handlePreviewClick() {
  const audio = audioRef.value;
  if (audio) {
    if (audioPlaying.value) {
      audio.pause();
    } else {
      audio.play();
    }
    audioPlaying.value = !audioPlaying.value;
    showControls.value = true;

    // Reset the controls timeout
    clearTimeout(controlsTimeout.value);
    controlsTimeout.value = setTimeout(() => {
      showControls.value = false;
    }, 3000);
  }
}

function rewindTrack() {
  const audio = audioRef.value;
  if (audio) {
    audio.currentTime = Math.max(0, audio.currentTime - 10);
    showControls.value = true;
  }
}

function forwardTrack() {
  const audio = audioRef.value;
  if (audio) {
    audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
    showControls.value = true;
  }
}

function onPlay() {
  audioPlaying.value = true;
  showControls.value = true;
}

function onPause() {
  audioPlaying.value = false;
}

function onEnded() {
  audioPlaying.value = false;
  showControls.value = false;
}

onMounted(() => {
  title.value = decodeURIComponent(route.params.title);
  description.value = decodeURIComponent(route.params.description);
  price.value = route.params.price;
  category.value = route.params.category;

  isLoading.value = false;
});
</script>

<style scoped>
/* Audio-specific styles */
.audio-preview {
  @apply flex flex-col items-center gap-4;
}

.audio-cover {
  @apply relative w-64 h-64 md:w-80 md:h-80
         rounded-lg overflow-hidden
         shadow-[0_0_20px_rgba(0,0,0,0.4)]
         border-2 border-gray-700/50;
}

.audio-cover img {
  @apply w-full h-full object-cover;
}

.audio-controls {
  @apply flex items-center justify-center gap-4
         bg-gray-800/90 rounded-full p-2
         backdrop-blur-sm;
}

.audio-progress {
  @apply w-full h-1 bg-gray-700 rounded-full
         overflow-hidden mt-4;
}

.progress-bar {
  @apply h-full bg-blue-500 rounded-full
         transition-all duration-200;
}

/* Inherit base channel styles */
.channel-guide {
  @apply bg-gradient-to-br from-gray-900 to-black min-h-screen text-white;
}

.channel-guide-content {
  @apply max-w-4xl mx-auto px-4 py-8;
}

.channel-guide-item {
  @apply bg-gray-800/90 rounded-lg shadow-xl p-6 backdrop-blur-sm;
}

.channel-guide-title {
  @apply text-2xl md:text-3xl font-bold text-white mb-4;
  background: linear-gradient(to right, #fff, #94a3b8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.show-description {
  @apply text-gray-300 mb-6;
}

.image-container {
  position: relative;
  display: inline-block;
}

.file-image {
  max-width: 90%;
  height: auto;
  margin: auto;
  display: block;
  border: 4px solid #333;
  box-shadow: 0 0 20px #000000cc;
  border-radius: 10px;
}

.play-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  background-color: rgba(0, 0, 0, 0.7); /* Darker overlay */
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 24px;
  color: white;
  cursor: pointer;
}

.play-button.active {
  background-color: rgba(0, 0, 0, 0.9); /* Darker when active */
}

.audio-player {
  display: none; /* Hide default controls */
}

/* Loading States */
.loading-indicator {
  @apply flex justify-center items-center p-8;
}

.loading-spinner {
  @apply animate-spin rounded-full h-12 w-12
         border-t-2 border-b-2 border-blue-500;
}

/* Payment Modal */
.payment-popup {
  @apply fixed inset-0 bg-black/75 
         flex items-center justify-center
         backdrop-blur-sm z-50;
}

.popup-content {
  @apply bg-gray-800 rounded-lg shadow-xl
         max-w-md w-full mx-4 p-6
         border border-gray-700/50;
}

/* Responsive Design */
@media (max-width: 640px) {
  .channel-guide-content {
    @apply px-2;
  }

  .image-container {
    @apply w-full;
  }

  .media-controls {
    @apply opacity-100;
  }
}

@media (min-width: 641px) and (max-width: 1024px) {
  .channel-guide-content {
    @apply px-4;
  }

  .image-container {
    @apply w-11/12;
  }
}

@media (min-width: 1025px) {
  .channel-guide-content {
    @apply px-6;
  }

  .image-container {
    @apply w-4/5;
  }
}
</style>
