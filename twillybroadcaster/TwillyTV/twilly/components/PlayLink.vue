<template>
  <div>
    <!-- Play Button -->
    <button @click="openMediaDialog" class="text-teal-400 hover:text-teal-300 transition-colors">
      <Icon name="heroicons:play-circle" class="w-6 h-6" />
    </button>

    <!-- Preview Modal -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div v-if="showMediaDialog" 
           class="fixed inset-0 z-50 overflow-y-auto"
           @click.self="closeMediaDialog"
           @keydown.esc="closeMediaDialog">
        <div class="fixed inset-0 bg-black/75 backdrop-blur-sm"></div>
        
        <div class="flex min-h-screen items-center justify-center p-4">
          <div class="relative bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <!-- Header with close button -->
            <div class="absolute top-0 right-0 left-0 flex justify-between items-center p-4 z-10 bg-gradient-to-b from-black/50 to-transparent">
              <div class="text-white/90 font-medium"></div>
              <button 
                @click="closeMediaDialog"
                class="bg-black/50 hover:bg-black/70 p-2 rounded-full text-white/90 hover:text-white transition-all"
                aria-label="Close">
                <Icon name="heroicons:x-mark" class="w-5 h-5" />
              </button>
            </div>

            <!-- Media Content -->
            <div class="relative bg-black">
              <!-- Image -->
              <div v-if="isImage" class="p-4">
                <img 
                  :src="props.url" 
                  alt="Media Preview" 
                  class="max-h-[70vh] w-auto mx-auto rounded-lg" 
                />
              </div>

              <!-- HLS Video -->
              <div v-else-if="isHlsVideo" 
                   class="aspect-video max-h-[70vh]"
                   @click.stop>
                <ClientOnly>
                  <VideoPlayer
                    type="default"
                    :link="props.url"
                    :previewImageLink="previewUrl || 'https://d4idc5cmwxlpy.cloudfront.net/No_Image_Available.jpg'"
                    class="w-full h-full"
                    :isMuted="false"
                    :isControls="true"
                  />
                </ClientOnly>
              </div>

              <!-- Standard Video -->
              <div v-else-if="isStandardVideo" 
                   class="aspect-video max-h-[70vh]"
                   @click.stop>
                <video 
                  controls 
                  class="w-full h-full"
                  controlsList="nodownload"
                  playsinline
                >
                  <source :src="props.url" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              <!-- Audio -->
              <div v-else-if="isAudio" class="p-4" @click.stop>
                <div class="max-w-sm mx-auto py-8">
                  <!-- Audio Preview Image -->
                  <div class="relative aspect-square mb-4 rounded-lg overflow-hidden bg-gray-800">
                    <img
                      v-if="previewUrl"
                      :src="previewUrl"
                      alt="Audio Cover"
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <Icon name="heroicons:musical-note" class="w-12 h-12 text-gray-600" />
                    </div>

                    <!-- Play/Pause Overlay -->
                    <div
                      class="absolute inset-0 flex items-center justify-center bg-black/50 hover:bg-black/60 cursor-pointer"
                      @click="handlePreviewClick"
                    >
                      <Icon 
                        :name="audioPlaying ? 'heroicons:pause-circle' : 'heroicons:play-circle'" 
                        class="w-12 h-12 text-white/90 hover:text-white"
                      />
                    </div>
                  </div>

                  <!-- Audio Controls -->
                  <audio
                    ref="audioRef"
                    :src="props.url"
                    controls
                    @play="onPlay"
                    @pause="onPause"
                    @ended="onEnded"
                    class="w-full"
                    controlsList="nodownload"
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { VideoPlayer } from 'vue-hls-video-player';

const props = defineProps({
  url: String,
  category: String,
  previewUrl: String
});

const showMediaDialog = ref(false);
const audioPlaying = ref(false);
const audioRef = ref(null);

const isImage = computed(() => /\.(jpg|jpeg|png|gif)$/i.test(props.url));
const isHlsVideo = computed(() => /\.m3u8$/i.test(props.url));
const isStandardVideo = computed(() => /\.(mp4|mov|avi|mkv|flv|wmv|webm)$/i.test(props.url) && !isHlsVideo.value);
const isAudio = computed(() => /\.(mp3|wav|ogg)$/i.test(props.url));

const handlePreviewClick = () => {
  const audio = audioRef.value;
  if (audio) {
    if (!audioPlaying.value) {
      audio.play();
    } else {
      audio.pause();
    }
  }
};

const onPlay = () => {
  audioPlaying.value = true;
};

const onPause = () => {
  audioPlaying.value = false;
};

const onEnded = () => {
  audioPlaying.value = false;
};

const openMediaDialog = () => {
  showMediaDialog.value = true;
  // Prevent body scroll when modal is open
  document.body.style.overflow = 'hidden';
};

const closeMediaDialog = () => {
  showMediaDialog.value = false;
  // Restore body scroll
  document.body.style.overflow = '';
  // Pause any playing media
  if (audioRef.value) {
    audioRef.value.pause();
  }
};

// Add keyboard event listener when mounted
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

// Remove event listener when component is unmounted
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

// Handle keyboard events
const handleKeydown = (e) => {
  if (e.key === 'Escape' && showMediaDialog.value) {
    closeMediaDialog();
  }
};
</script>

<style scoped>
/* Custom styling for the video player */
:deep(.video-player) {
  max-height: 70vh;
}

/* Custom audio player styling */
audio {
  border-radius: 0.5rem;
  background-color: rgba(255, 255, 255, 0.1);
}

audio::-webkit-media-controls-panel {
  background-color: rgba(255, 255, 255, 0.1);
}

/* Prevent text selection during double-click */
.media-dialog {
  user-select: none;
}
</style>
