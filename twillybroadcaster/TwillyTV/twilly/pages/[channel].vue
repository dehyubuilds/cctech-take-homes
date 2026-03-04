<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black relative overflow-hidden">
    <!-- Real-time Status Indicator -->
    <div v-if="wsBrain && wsBrain.isConnected" class="fixed top-4 right-4 z-50 bg-black/80 backdrop-blur-sm border border-teal-500/30 rounded-xl p-3 shadow-xl max-w-[120px] sm:max-w-none">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
        <span class="text-xs text-teal-300 font-medium">LIVE</span>
        <span class="text-xs text-gray-400 hidden sm:inline">{{ liveViewerCount }} watching</span>
      </div>
    </div>

    <!-- Animated background pattern -->
    <div class="absolute inset-0 opacity-10">
      <div class="absolute top-20 left-20 w-32 h-32 bg-teal-400/20 rounded-full blur-xl animate-pulse"></div>
      <div class="absolute top-40 right-32 w-24 h-24 bg-cyan-400/20 rounded-full blur-lg animate-pulse delay-1000"></div>
      <div class="absolute bottom-32 left-1/3 w-40 h-40 bg-teal-500/15 rounded-full blur-2xl animate-pulse delay-2000"></div>
    </div>

    <!-- Hero Section with Creator-Focused Design -->
    <div class="relative w-full h-[35vh] sm:h-[40vh] overflow-hidden bg-black">
      <!-- Background Image -->
      <div v-if="isLoadingMetadata" class="absolute inset-0 bg-gradient-to-br from-teal-900 via-black to-purple-900 flex items-center justify-center z-10">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-400 border-t-transparent mb-4"></div>
          <p class="text-white text-lg font-medium">Loading your streaming series...</p>
        </div>
      </div>
      <div v-else-if="posterUrl" class="w-full h-full flex items-center justify-center">
        <img 
          :src="posterUrl" 
          class="max-w-full max-h-full object-contain"
          :alt="menuTitle || 'Channel Poster'"
          @error="handlePosterError"
        />
      </div>
      
    </div>

    <!-- Creator Navigation -->
    <div class="bg-black/50 backdrop-blur-sm border-b border-white/10">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div class="flex items-center gap-4">
            <!-- Twilly Branding -->
            <div class="inline-flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
              <div class="w-6 h-6 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full flex items-center justify-center">
                <Icon name="heroicons:play" class="w-3 h-3 text-white" />
              </div>
              <span class="text-white font-semibold text-xs sm:text-sm">Twilly Creator Series</span>
            </div>
            
            <NuxtLink 
              to="/channel-guide"
              class="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200 font-medium px-4 py-2 rounded-lg hover:bg-white/10 cursor-pointer"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              <span>Explore All Series</span>
            </NuxtLink>
          </div>
          
          <!-- Creator Actions -->
          <div class="flex items-center gap-3">
            <button class="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200 font-medium px-4 py-2 rounded-lg hover:bg-white/10">
              <Icon name="heroicons:share" class="w-4 h-4" />
              <span class="hidden sm:inline">Share Series</span>
            </button>
            <button class="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-200 font-medium px-4 py-2 rounded-lg hover:bg-white/10">
              <Icon name="heroicons:heart" class="w-4 h-4" />
              <span class="hidden sm:inline">Follow</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Channel Title and Info Section -->
    <div class="max-w-7xl mx-auto px-4 py-4 sm:py-6 md:py-8">
      <div class="text-center">
        <!-- Series Title -->
        <h1 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-3 sm:mb-4 md:mb-6 leading-tight px-2">
          {{ menuTitle }}
        </h1>
        
        <!-- Creator Description -->
        <p class="text-gray-200 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl max-w-4xl mx-auto mb-4 sm:mb-6 md:mb-8 leading-relaxed px-2">
          {{ menuDescription || 'Record your story, share your link, and get paid when people watch.' }}
        </p>
        
        <!-- Creator Stats -->
        <div class="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8">
          <div class="flex items-center gap-2 text-white/80">
            <Icon name="heroicons:video-camera" class="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
            <span class="text-xs sm:text-sm md:text-base font-medium">{{ getContentCount('Videos') }} Episodes</span>
          </div>
          <div class="flex items-center gap-2 text-white/80">
            <Icon name="heroicons:users" class="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            <span class="text-xs sm:text-sm md:text-base font-medium">Creator Channel</span>
          </div>
          <div class="flex items-center gap-2 text-white/80">
            <Icon name="heroicons:currency-dollar" class="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
            <span class="text-xs sm:text-sm md:text-base font-medium">Pay-Per-View</span>
          </div>
        </div>
      </div>
    </div>
        
    <!-- Creator Series Overview -->
    <div class="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <div class="bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-white/10 shadow-2xl">
        <div class="text-center mb-6 sm:mb-8">
          <div class="inline-flex items-center gap-2 sm:gap-3 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 rounded-full px-4 sm:px-6 py-2 sm:py-3 border border-teal-500/30 mb-4 sm:mb-6">
            <Icon name="heroicons:sparkles" class="w-4 h-4 sm:w-5 sm:h-5 text-teal-400" />
            <span class="text-teal-300 font-semibold text-xs sm:text-sm">Creator Series</span>
          </div>
          <h2 class="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4 px-2">Your Streaming Episodes</h2>
          <p class="text-gray-300 text-sm sm:text-base md:text-lg max-w-3xl mx-auto px-2">
            Record your story, share your link, and get paid when people watch. 
            <span class="text-teal-400 font-semibold">Join a platform built for creators — not algorithms.</span>
          </p>
        </div>
          
        <!-- Creator Stats Dashboard -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div class="bg-gradient-to-br from-teal-500/10 to-teal-600/5 rounded-2xl p-4 sm:p-6 border border-teal-500/20 hover:border-teal-400/40 transition-all duration-300">
            <div class="flex items-center gap-3 sm:gap-4">
              <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <Icon name="heroicons:video-camera" class="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <div class="text-xl sm:text-2xl font-bold text-white">{{ getContentCount('Videos') }}</div>
                <div class="text-teal-300 text-xs sm:text-sm font-medium">{{ getContentCount('Videos') === 1 ? 'Episode' : 'Episodes' }}</div>
              </div>
            </div>
          </div>
          
          <div class="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-2xl p-4 sm:p-6 border border-cyan-500/20 hover:border-cyan-400/40 transition-all duration-300">
            <div class="flex items-center gap-3 sm:gap-4">
              <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                <Icon name="heroicons:currency-dollar" class="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <div class="text-lg sm:text-xl md:text-2xl font-bold text-white">Pay-Per-View</div>
                <div class="text-cyan-300 text-xs sm:text-sm font-medium">Monetize Content</div>
              </div>
            </div>
          </div>
          
          <div class="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-2xl p-4 sm:p-6 border border-purple-500/20 hover:border-purple-400/40 transition-all duration-300">
            <div class="flex items-center gap-3 sm:gap-4">
              <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Icon name="heroicons:users" class="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <div class="text-lg sm:text-xl md:text-2xl font-bold text-white">Creator</div>
                <div class="text-purple-300 text-xs sm:text-sm font-medium">Built for You</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Creator Episodes Section -->
    <div class="max-w-7xl mx-auto px-4 py-8 sm:py-12">
      <!-- Section Header -->
      <div class="text-center mb-8 sm:mb-12">
        <h2 class="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4 px-2">Your Episodes</h2>
        <p class="text-gray-300 text-sm sm:text-base md:text-lg max-w-2xl mx-auto px-2">
          Each episode is your story. Share your link, get paid when people watch.
        </p>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-center py-12 sm:py-16">
        <div class="inline-block animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-teal-400 border-t-transparent mb-4 sm:mb-6"></div>
        <p class="text-gray-300 text-base sm:text-lg md:text-xl font-medium">Loading your episodes...</p>
        <p class="text-gray-500 text-xs sm:text-sm mt-2">Preparing your creator content</p>
      </div>

      <!-- Episodes Grid -->
      <div v-else-if="displayItems.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8 sm:gap-10">
        <div v-for="item in displayItems" :key="item.SK" 
          class="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-xl border border-white/10 hover:border-teal-400/50 transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/20 hover:scale-105 transform">
          
          <!-- Creator Episode Badge -->
          <div class="absolute top-4 right-4 z-20">
            <div v-if="item.price > 0 && item.price !== '0.00' && item.price !== '0' && item.price !== 'Free' && item.price !== '0-00'" 
                 class="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg backdrop-blur-sm flex items-center gap-2 border border-white/20">
              <Icon name="heroicons:currency-dollar" class="w-4 h-4" />
              <span>${{ item.price }}</span>
            </div>
            <div v-else class="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg backdrop-blur-sm flex items-center gap-2 border border-white/20">
              <Icon name="heroicons:gift" class="w-4 h-4" />
              <span>Free</span>
            </div>
          </div>

          <!-- Episode Preview -->
          <div class="relative aspect-[4/3] overflow-hidden">
            <img
              :src="item.thumbnailUrl || item.url || '/images/coming-soon.jpg'"
              :alt="item.title || 'Coming Soon'"
              class="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
            />
            
            <!-- Episode Overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent">
              <div class="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8">
                <h3 class="text-white text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-3 md:mb-4 group-hover:text-teal-400 transition-colors duration-300 line-clamp-2">{{ item.title || 'Coming Soon' }}</h3>
                <p class="text-gray-300 text-xs sm:text-sm md:text-base line-clamp-2 group-hover:text-white transition-colors duration-300 mb-2 sm:mb-3 md:mb-4">{{ item.description || 'Your story, your way.' }}</p>
                
                <!-- Episode Status -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div v-if="item.category === 'Videos'" class="flex items-center gap-1 text-teal-400 text-sm font-medium">
                      <Icon name="heroicons:play" class="w-4 h-4" />
                      <span>Episode</span>
                    </div>
                    <div v-else-if="item.category === 'Audios'" class="flex items-center gap-1 text-cyan-400 text-sm font-medium">
                      <Icon name="heroicons:musical-note" class="w-4 h-4" />
                      <span>Audio</span>
                    </div>
                    <div v-else-if="item.category === 'Images'" class="flex items-center gap-1 text-purple-400 text-sm font-medium">
                      <Icon name="heroicons:photo" class="w-4 h-4" />
                      <span>Image</span>
                    </div>
                    <div v-else class="flex items-center gap-1 text-green-400 text-sm font-medium">
                      <Icon name="heroicons:document" class="w-4 h-4" />
                      <span>Document</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Creator Action Button -->
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
              <button
                @click.stop="handlePreview(item)"
                class="p-4 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 rounded-full transition-all duration-300 transform hover:scale-110 shadow-2xl hover:shadow-teal-500/50 border border-white/20 backdrop-blur-sm"
                :title="item.category === 'Videos' || item.category === 'Audios' ? 'Watch Episode' : 'View Content'"
              >
                <Icon 
                  :name="item.category === 'Videos' || item.category === 'Audios' ? 'heroicons:play' : 'heroicons:eye'" 
                  class="w-6 h-6 text-white" 
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Creator Empty State -->
      <div v-else-if="!isLoading && displayItems.length === 0" class="text-center py-12 sm:py-16 md:py-20">
        <div class="inline-block p-6 sm:p-8 md:p-12 rounded-3xl bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-xl border border-white/10 mb-6 sm:mb-8">
          <div class="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Icon name="heroicons:video-camera" class="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h3 class="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 px-2">Start Your Series</h3>
          <p class="text-gray-300 max-w-lg mx-auto text-sm sm:text-base md:text-lg mb-4 sm:mb-6 px-2">
            Record your story, share your link, and get paid when people watch. 
            <span class="text-teal-400 font-semibold">Join a platform built for creators — not algorithms.</span>
          </p>
          <div class="flex items-center justify-center gap-2 text-teal-400">
            <Icon name="heroicons:sparkles" class="w-4 h-4 sm:w-5 sm:h-5" />
            <span class="text-xs sm:text-sm font-medium">Your episodes will appear here</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useFileStore } from '~/stores/useFileStore';
import { useWebSocketBrain } from '~/stores/WebSocketBrain';

const route = useRoute();
const fileStore = useFileStore();

// Initialize WebSocket store for real-time features
const wsBrain = useWebSocketBrain();

const isLoading = ref(true);
const isLoadingMetadata = ref(true);
const error = ref(null);
const menuItems = ref([]);
const menuTitle = ref('');
const menuDescription = ref('');
const posterUrl = ref('');
const userEmail = ref('');
const series = ref('');

// WebSocket reactive data
const liveViewerCount = ref(42);

// Watch for WebSocket connection changes
let lastConnectionState = null;
watch(() => wsBrain.isConnected, (connected) => {
  if (lastConnectionState !== connected) {
    lastConnectionState = connected;
    if (connected) {
      console.log('✅ [Channel] WebSocket connected');
    }
  }
}, { immediate: true });

// Watch for WebSocket data updates
watch(() => wsBrain.liveStreams, (streams) => {
  if (streams && streams.length > 0) {
    liveViewerCount.value = streams.reduce((total, stream) => total + (stream.viewers || 0), 0);
  }
}, { deep: true });

// Handle poster image errors
const handlePosterError = (event) => {
  console.error('[Channel] Poster image failed to load:', posterUrl.value);
  // Fallback to default poster
  event.target.src = 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
};

// Get content count by type
const getContentCount = (type) => {
  return displayItems.value.filter(item => item.category === type).length;
};

// Handle preview (placeholder for now)
const handlePreview = (item) => {
  console.log('[Channel] Preview item:', item);
  // TODO: Implement preview functionality
};

// Filter out .jpg/.jpeg files and mock/sample items from display (same logic as menu/share page)
const displayItems = computed(() => {
  console.log('[Channel] displayItems computed - menuItems.value.length:', menuItems.value.length);
  const filtered = menuItems.value.filter(item => {
    // Filter out mock/sample items (items with SK starting with 'mock-' or URLs containing 'example.com')
    const sk = item.SK || '';
    const url = item.url || '';
    
    if (sk.startsWith('mock-') || url.includes('example.com')) {
      console.log('[Channel] Filtering out mock/sample item:', item.title);
      return false;
    }
    
    const fileName = item.fileName || item.title || '';
    
    // Only filter out if the MAIN content URL is a .jpg/.jpeg file (not thumbnail URLs)
    // For videos, the URL should be .m3u8, so we want to keep those
    if (url.includes('.jpg') || url.includes('.jpeg') || 
        fileName.includes('.jpg') || fileName.includes('.jpeg')) {
      console.log('[Channel] Filtering out .jpg/.jpeg file - URL:', url, 'fileName:', fileName);
      return false;
    }
    return true;
  });
  console.log('[Channel] displayItems computed - filtered.length:', filtered.length);
  console.log('[Channel] displayItems computed - filtered items:', filtered.map(item => ({ title: item.title, url: item.url, fileName: item.fileName })));
  return filtered;
});

onMounted(async () => {
  const channelSlug = route.params.channel;
  console.log('🚀 [Channel] Loading channel:', channelSlug);
  
  try {
    isLoading.value = true;
    error.value = null;
    
    // Fetch channel metadata by slug
    const shareParams = await $fetch('/api/creators/get-share-params-by-series', {
      method: 'POST',
      body: { seriesSlug: channelSlug }
    });
    
    console.log('[Channel] Share params:', shareParams);
    
    if (!shareParams || !shareParams.success) {
      throw new Error('Failed to load channel metadata');
    }
    
    // Get email from share params (API now returns it)
    userEmail.value = shareParams.email || 'dehyu.sinyan@gmail.com'; // Fallback to master account
    
    // Use the exact series name from the API (this matches what's in DynamoDB)
    // This is important because the series name might have emojis or special characters
    series.value = shareParams.series || shareParams.title || channelSlug;
    
    console.log('[Channel] Using series name:', series.value);
    console.log('[Channel] Using email:', userEmail.value);
    
    // Set poster URL - use the exact poster from the API
    let posterUrlFromParams = shareParams.originalPosterUrl;
    console.log('[Channel] Original poster URL from API:', posterUrlFromParams);
    
    if (!posterUrlFromParams) {
      console.warn('[Channel] No poster URL from API, using default');
      posterUrlFromParams = 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
    }
    
    // Normalize poster URL (same logic as menu/share page)
    if (posterUrlFromParams.includes('d4idc5cmwxlpy.cloudfront.net')) {
      posterUrlFromParams = posterUrlFromParams.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
    }
    if (posterUrlFromParams.includes('/series-posters/') && !posterUrlFromParams.includes('/public/series-posters/')) {
      posterUrlFromParams = posterUrlFromParams.replace('/series-posters/', '/public/series-posters/');
    }
    
    posterUrl.value = posterUrlFromParams;
    console.log('[Channel] Final poster URL:', posterUrl.value);
    
    // Set title and description immediately so they show up
    menuTitle.value = shareParams.title || series.value || channelSlug;
    menuDescription.value = shareParams.description || `Check out this series on Twilly`;
    
    // Mark metadata as loaded so poster and title show immediately
    isLoadingMetadata.value = false;
    
    // Don't check if poster exists - just use it (same as menu/share page)
    // The image will handle errors with @error handler if needed
    
    // Fetch menu items using the email - using $fetch like managefiles.vue and menu/share
    const apiUrl = `/api/menu-items?email=${encodeURIComponent(userEmail.value)}&series=${encodeURIComponent(series.value)}`;
    console.log('[Channel] About to call API endpoint:', apiUrl);
    console.log('[Channel] userEmail:', userEmail.value);
    console.log('[Channel] series:', series.value);
    
    const data = await $fetch(apiUrl);
    console.log('[Channel] $fetch call successful!');
    console.log('[Channel] Raw API data:', data);
    
    const itemsToFilter = data.items || data; // Support both new and old formats
    
    // Set menu items - filtering will be done by displayItems computed property
    menuItems.value = itemsToFilter;
    console.log('[Channel] menuItems.value set to:', menuItems.value);
    console.log('[Channel] Total items before filtering:', menuItems.value.length);
    
    // Set up metadata
    useHead({
      title: menuTitle.value,
      meta: [
        { property: 'og:title', content: menuTitle.value },
        { property: 'og:description', content: menuDescription.value },
        { property: 'og:image', content: posterUrl.value },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: route.fullPath },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: menuTitle.value },
        { name: 'twitter:description', content: menuDescription.value },
        { name: 'twitter:image', content: posterUrl.value }
      ],
      link: [{ rel: 'canonical', href: route.fullPath }]
    });
    
    // Initialize WebSocket connection
    if (process.client) {
      const { $switchToChannel } = useNuxtApp();
      if ($switchToChannel && userEmail.value && series.value) {
        $switchToChannel(userEmail.value, series.value);
      }
    }
    
  } catch (err) {
    console.error('[Channel] Error loading channel:', err);
    error.value = err.message || 'Failed to load channel content';
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}

/* Add line clamping for descriptions */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Animation delays for pulse effects */
.delay-1000 {
  animation-delay: 1s;
}

.delay-2000 {
  animation-delay: 2s;
}
</style>
