<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <!-- Fixed Header -->
    <div class="sticky top-0 z-10 bg-gradient-to-br from-[#084d5d] to-black py-6 sm:py-8 px-4">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-3xl sm:text-4xl font-bold text-white mb-2 text-center sm:text-left">
          My <span class="text-teal-400">Stream Links</span>
        </h1>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-7xl mx-auto px-4 py-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400 mb-4"></div>
        <p class="text-gray-300">Loading stream menus...</p>
      </div>

      <!-- Stream Menu Sections -->
      <div v-else class="space-y-12">
        <!-- Stream Collections Section -->
        <section v-if="streamCollections.length > 0">
          <div class="flex items-center gap-3 mb-6">
            <Icon name="heroicons:video-camera" class="w-6 h-6 text-teal-400" />
            <h2 class="text-xl sm:text-2xl font-bold text-white">Stream Collections</h2>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div v-for="collection in streamCollections" :key="collection.id" 
                 class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-4 sm:p-6">
              <!-- Collection Preview -->
              <div class="relative aspect-video mb-4 rounded-lg overflow-hidden">
                <img 
                  :src="collection.thumbnailUrl || 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Stream+Collection'" 
                  :alt="collection.name"
                  class="w-full h-full object-cover"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                  <div class="absolute bottom-0 left-0 right-0 p-4">
                    <h3 class="text-white text-lg font-medium">{{ collection.name }}</h3>
                    <p class="text-gray-300 text-sm">{{ collection.clips.length }} clips</p>
                  </div>
                </div>
              </div>

              <div class="space-y-3">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-400">Created:</span>
                  <span class="text-white">{{ formatDate(collection.createdAt) }}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-400">Total Duration:</span>
                  <span class="text-white">{{ formatTotalDuration(collection.clips) }}</span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-400">Total Value:</span>
                  <span class="text-teal-400 font-bold">${{ calculateTotalValue(collection.clips) }}</span>
                </div>
              </div>

              <div class="mt-4 space-y-2">
                <button 
                  @click="generateShareLink(collection)"
                  class="w-full px-4 py-2 bg-teal-500/20 text-teal-300 rounded-lg text-sm
                         hover:bg-teal-500/30 transition-all duration-300"
                >
                  Generate Stream Link
                </button>
                
                <button 
                  @click="openPreviewModal(collection)"
                  class="w-full px-4 py-2 bg-gray-500/20 text-gray-300 rounded-lg text-sm
                         hover:bg-gray-500/30 transition-all duration-300"
                >
                  Preview Collection
                </button>
              </div>

              <!-- Share Link Box -->
              <div v-if="shareableLink && selectedCollection?.id === collection.id" 
                   class="mt-4 bg-black/30 backdrop-blur-sm rounded-xl border border-teal-500/30 p-4">
                <div class="flex flex-col sm:flex-row items-center gap-4">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-gray-400 mb-2">Shareable Link</p>
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        :value="shareableLink"
                        readonly
                        class="w-full bg-black/20 border border-teal-500/30 rounded-lg px-4 py-2 text-white truncate"
                      />
                      <button
                        @click="copyLink"
                        class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                      >
                        <Icon name="heroicons:clipboard" class="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Individual Clips Section -->
        <section v-if="individualClips.length > 0">
          <div class="flex items-center gap-3 mb-6">
            <Icon name="heroicons:play" class="w-6 h-6 text-teal-400" />
            <h2 class="text-xl sm:text-2xl font-bold text-white">Individual Clips</h2>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            <div v-for="clip in individualClips" :key="clip.id" 
                 class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-4">
              <!-- Clip Preview -->
              <div class="relative aspect-video mb-3 rounded-lg overflow-hidden">
                <video
                  :src="clip.hlsUrl"
                  :poster="clip.thumbnailUrl"
                  class="w-full h-full object-cover"
                  preload="metadata"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                  <div class="absolute bottom-0 left-0 right-0 p-3">
                    <h3 class="text-white text-sm font-medium truncate">{{ clip.title }}</h3>
                    <p class="text-gray-300 text-xs">{{ formatDuration(clip.duration) }}</p>
                  </div>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-400">Duration:</span>
                  <span class="text-white">{{ formatDuration(clip.duration) }}</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-400">Price:</span>
                  <span class="text-teal-400 font-bold">${{ clip.price }}</span>
                </div>
              </div>

              <div class="mt-3 space-y-2">
                <button 
                  @click="generateClipLink(clip)"
                  class="w-full px-3 py-1.5 bg-teal-500/20 text-teal-300 rounded text-xs
                         hover:bg-teal-500/30 transition-all duration-300"
                >
                  Generate Link
                </button>
              </div>

              <!-- Share Link Box for Individual Clips -->
              <div v-if="shareableLink && selectedClip?.id === clip.id" 
                   class="mt-3 bg-black/30 backdrop-blur-sm rounded-lg border border-teal-500/30 p-3">
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    :value="shareableLink"
                    readonly
                    class="flex-1 bg-black/20 border border-teal-500/30 rounded px-3 py-1.5 text-white text-xs truncate"
                  />
                  <button
                    @click="copyLink"
                    class="px-3 py-1.5 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded hover:bg-teal-500/30 transition-all duration-300"
                  >
                    <Icon name="heroicons:clipboard" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Empty State -->
        <div v-if="streamCollections.length === 0 && individualClips.length === 0" class="text-center py-12">
          <Icon name="heroicons:video-camera" class="w-12 h-12 text-teal-400/50 mx-auto mb-4" />
          <h3 class="text-xl font-semibold text-white mb-2">No Stream Content Found</h3>
          <p class="text-gray-400">Create stream clips to start sharing</p>
        </div>

        <!-- Loading State for Link Generation -->
        <div v-if="isGeneratingLink" class="mt-8 flex items-center justify-center">
          <div class="flex flex-col items-center gap-4">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-400 border-t-transparent"></div>
            <p class="text-gray-400">Generating share link...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview Modal -->
    <Modal v-if="showPreviewModal">
      <div class="relative max-w-4xl mx-auto">
        <div class="mb-6 text-center">
          <h3 class="text-xl font-semibold text-white">
            Preview <span class="text-teal-400">{{ previewCollection?.name }}</span>
          </h3>
        </div>
        
        <button 
          @click="showPreviewModal = false"
          class="absolute top-0 right-0 p-2 text-gray-400 hover:text-white transition-colors duration-200"
        >
          <Icon name="heroicons:x-mark" class="w-5 h-5" />
        </button>

        <div class="space-y-4 max-h-[70vh] overflow-y-auto">
          <div v-for="clip in previewCollection?.clips" :key="clip.id" 
               class="bg-black/20 rounded-lg p-4 border border-teal-500/30">
            <div class="flex items-start gap-4">
              <div class="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0">
                <video
                  :src="clip.hlsUrl"
                  :poster="clip.thumbnailUrl"
                  class="w-full h-full object-cover"
                  preload="metadata"
                />
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-white font-medium mb-1">{{ clip.title }}</h4>
                <p class="text-gray-300 text-sm mb-2">{{ clip.description }}</p>
                <div class="flex items-center gap-4 text-xs text-gray-400">
                  <span>{{ formatDuration(clip.duration) }}</span>
                  <span>${{ clip.price }}</span>
                  <span>{{ formatDate(clip.createdAt) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useTaskStore } from '~/stores/TaskStore';
import Modal from '@/components/Modal.vue';

const authStore = useAuthStore();
const taskStore = useTaskStore();
const isLoading = ref(true);
const isGeneratingLink = ref(false);
const shareableLink = ref('');
const selectedCollection = ref(null);
const selectedClip = ref(null);
const showPreviewModal = ref(false);
const previewCollection = ref(null);

// Stream data
const streamCollections = ref([]);
const individualClips = ref([]);

// Initialize
onMounted(async () => {
  try {
    if (!authStore.authenticated || !authStore.user) {
      navigateTo('/login');
      return;
    }
    
    await fetchStreamData();
  } catch (error) {
    console.error('Error initializing stream sharing:', error);
  } finally {
    isLoading.value = false;
  }
});

// Fetch stream data
const fetchStreamData = async () => {
  try {
    // This would call your API to get stream data
    const response = await $fetch('/api/streams/sharing', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.user.attributes.sub}`
      }
    });
    
    streamCollections.value = response.collections || [];
    individualClips.value = response.individualClips || [];
  } catch (error) {
    console.error('Error fetching stream data:', error);
    // For now, use mock data
    streamCollections.value = [
      {
        id: '1',
        name: 'Dark Knights Event Collection',
        description: 'Complete collection from the Dark Knights event',
        thumbnailUrl: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Dark+Knights',
        createdAt: new Date().toISOString(),
        clips: [
          {
            id: 'clip1',
            title: 'Opening Ceremony',
            description: 'Live stream from the opening ceremony',
            duration: 1800,
            price: 5.99,
            hlsUrl: 'https://your-cloudfront.net/events/dark-knights-1/playlist.m3u8',
            thumbnailUrl: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Opening',
            createdAt: new Date().toISOString()
          },
          {
            id: 'clip2',
            title: 'Main Event',
            description: 'The main event highlights',
            duration: 3600,
            price: 9.99,
            hlsUrl: 'https://your-cloudfront.net/events/dark-knights-2/playlist.m3u8',
            thumbnailUrl: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Main+Event',
            createdAt: new Date().toISOString()
          }
        ]
      }
    ];
    
    individualClips.value = [
      {
        id: 'individual1',
        title: 'Special Performance',
        description: 'Exclusive performance clip',
        duration: 900,
        price: 3.99,
        hlsUrl: 'https://your-cloudfront.net/events/special/playlist.m3u8',
        thumbnailUrl: 'https://via.placeholder.com/400x225/14b8a6/ffffff?text=Special',
        createdAt: new Date().toISOString()
      }
    ];
  }
};

// Generate share link for collection
const generateShareLink = async (collection) => {
  if (!authStore.user?.attributes?.sub) {
    console.error('No user ID available');
    return;
  }

  selectedCollection.value = collection;
  selectedClip.value = null;
  isGeneratingLink.value = true;

  try {
    const baseUrl = window.location.origin;
    const userId = authStore.user.attributes.sub;
    const collectionName = encodeURIComponent(collection.name);
    
    const longUrl = `${baseUrl}/streams/share/${userId}/${collectionName}?title=${encodeURIComponent(collection.name)}&description=${encodeURIComponent(collection.description || collection.name)}`;
    
    // Use taskStore to shorten the URL
    const response = await taskStore.shortenUrl({ url: longUrl });
    if (response && response.returnResult) {
      shareableLink.value = response.returnResult;
    } else {
      throw new Error('Failed to shorten URL');
    }
  } catch (error) {
    console.error('Error generating share link:', error);
    alert('Error generating share link');
  } finally {
    isGeneratingLink.value = false;
  }
};

// Generate share link for individual clip
const generateClipLink = async (clip) => {
  if (!authStore.user?.attributes?.sub) {
    console.error('No user ID available');
    return;
  }

  selectedClip.value = clip;
  selectedCollection.value = null;
  isGeneratingLink.value = true;

  try {
    const baseUrl = window.location.origin;
    const userId = authStore.user.attributes.sub;
    const clipId = clip.id;
    
    const longUrl = `${baseUrl}/streams/play/${clipId}?title=${encodeURIComponent(clip.title)}&description=${encodeURIComponent(clip.description || clip.title)}`;
    
    // Use taskStore to shorten the URL
    const response = await taskStore.shortenUrl({ url: longUrl });
    if (response && response.returnResult) {
      shareableLink.value = response.returnResult;
    } else {
      throw new Error('Failed to shorten URL');
    }
  } catch (error) {
    console.error('Error generating clip link:', error);
    alert('Error generating clip link');
  } finally {
    isGeneratingLink.value = false;
  }
};

// Preview collection
const openPreviewModal = (collection) => {
  previewCollection.value = collection;
  showPreviewModal.value = true;
};

// Copy link
const copyLink = () => {
  navigator.clipboard.writeText(shareableLink.value);
  alert('Link copied to clipboard!');
};

// Utility functions
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString();
};

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const formatTotalDuration = (clips) => {
  const totalSeconds = clips.reduce((sum, clip) => sum + (clip.duration || 0), 0);
  return formatDuration(totalSeconds);
};

const calculateTotalValue = (clips) => {
  return clips.reduce((sum, clip) => sum + (clip.price || 0), 0).toFixed(2);
};
</script>

<style scoped>
.aspect-video {
  aspect-ratio: 16 / 9;
}

.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}
</style> 