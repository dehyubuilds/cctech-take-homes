<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <!-- TEST BANNER -->
    <div class="bg-blue-500 text-white text-center py-2 font-bold">
      🧪 CLEAN URL SHARE PAGE 🧪
    </div>
    
    <!-- Header with Poster -->
    <div class="relative h-[50vh] w-full overflow-hidden">
      <div v-if="isLoading" class="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-400 border-t-transparent mb-4"></div>
          <p class="text-white text-lg font-medium">Loading exclusive content...</p>
        </div>
      </div>
      <img 
        v-else
        :src="posterUrl" 
        class="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
        :alt="menuTitle"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
      <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-8 md:p-12">
        <div class="max-w-7xl mx-auto">
          <div class="flex flex-col gap-4">
            <div>
              <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 leading-tight">
                {{ menuTitle }}
              </h1>
              <p class="text-gray-300 text-base sm:text-lg md:text-xl max-w-2xl">{{ menuDescription }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Back to Channel Guide Navigation -->
    <div class="max-w-7xl mx-auto px-4 py-4">
      <NuxtLink 
        to="/channel-guide"
        class="inline-flex items-center gap-2 text-teal-300 hover:text-teal-200 transition-colors duration-200 font-medium"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
        </svg>
        <span>Back to Channels</span>
      </NuxtLink>
    </div>

    <!-- Real-time Status Indicator -->
    <div v-if="wsBrain && wsBrain.isConnected" class="fixed top-4 right-4 z-50 bg-black/80 backdrop-blur-sm border border-teal-500/30 rounded-xl p-3 shadow-xl max-w-[120px] sm:max-w-none">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
        <span class="text-xs text-teal-300 font-medium">LIVE</span>
        <span class="text-xs text-gray-400 hidden sm:inline">{{ liveViewerCount }} watching</span>
      </div>
    </div>





    <!-- Content -->
    <div class="max-w-7xl mx-auto px-4 py-6 -mt-8 sm:-mt-12">
      
      <!-- Loading State -->
      <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="n in 6" :key="n" class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-4 animate-pulse">
          <div class="aspect-video bg-teal-900/20 rounded-lg mb-4"></div>
          <div class="h-6 bg-teal-900/20 rounded-lg w-3/4 mb-2"></div>
          <div class="h-4 bg-teal-900/20 rounded-lg w-1/2"></div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-8 sm:py-12">
        <div class="bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg p-4 mb-4 mx-3">
          {{ error }}
        </div>
      </div>

      <!-- Menu Items Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="item in displayItems" :key="item.SK"
           class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 overflow-hidden hover:border-teal-500/50 transition-all duration-300 relative">
          
          <!-- Real-time Updates Badge -->
          <div v-if="wsBrain && wsBrain.isConnected" class="absolute top-3 left-3 bg-teal-500/20 backdrop-blur-sm border border-teal-500/30 rounded-full px-2 py-1 z-10">
            <span class="text-xs text-teal-300 font-medium">Live Updates</span>
          </div>
          <!-- Item Image -->
          <div class="aspect-video relative">
            <img 
              :src="item.thumbnailUrl || item.url || '/images/coming-soon.jpg'"
              :alt="item.title || 'Coming Soon'"
              class="w-full h-full object-cover"
              loading="lazy"
            />
            <div v-if="item.price" class="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <span class="text-teal-400 font-semibold text-sm sm:text-base">${{ item.price }}</span>
            </div>
          </div>

          <!-- Item Details -->
          <div class="p-4 sm:p-6">
            <h3 class="text-lg sm:text-xl font-semibold text-white mb-2">
              {{ item.title || 'Coming Soon' }}
            </h3>
            <p class="text-gray-400 text-sm mb-3 sm:mb-4 line-clamp-3">
              {{ item.description || 'Description coming soon...' }}
            </p>
            <div v-if="item.price" class="flex items-center justify-between">
              <span class="text-teal-400 font-semibold text-base sm:text-lg">${{ item.price }}</span>
            </div>
            
            <!-- Live Status Indicator -->
            <div v-if="wsBrain && wsBrain.isConnected && isItemLive(item)" class="flex items-center gap-2 mt-3">
              <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span class="text-xs text-red-400 font-medium">LIVE NOW</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!isLoading && menuItems.length === 0" class="text-center py-8 sm:py-12">
        <Icon name="heroicons:square-2-stack" class="w-10 h-10 sm:w-12 sm:h-12 text-teal-400/50 mx-auto mb-4" />
        <h3 class="text-lg sm:text-xl font-semibold text-white mb-2">No Items Available</h3>
        <p class="text-gray-400 text-sm sm:text-base">This menu is currently empty</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useFileStore } from '~/stores/useFileStore';
import { useShareStore } from '~/stores/ShareStore';
import { useWebSocketBrain } from '~/stores/WebSocketBrain';
import { useChannelDescriptionStore } from '~/stores/useChannelDescriptionStore';

const route = useRoute();
const fileStore = useFileStore();
const shareStore = useShareStore();
const wsBrain = useWebSocketBrain();
const channelStore = useChannelDescriptionStore();

// Reactive data
const isLoading = ref(true);
const error = ref('');
const menuItems = ref([]);
const menuTitle = ref('');
const menuDescription = ref('');
const posterUrl = ref('');

// WebSocket reactive data
const liveViewerCount = ref(42); // Mock data for testing
const liveItems = ref([
  { id: 'item1', title: 'Live Stream 1' },
  { id: 'item2', title: 'Live Stream 2' }
]); // Mock data for testing


// Computed properties
const displayItems = computed(() => {
  return menuItems.value;
});

// Helper functions for WebSocket features
const isItemLive = (item) => {
  return liveItems.value.some(liveItem => liveItem.id === item.SK);
};

// Watch for WebSocket connection changes
watch(() => wsBrain?.isConnected, (connected) => {
  console.log('🔍 [Channel Page] WebSocket connection status changed:', connected);
  if (connected) {
    console.log('✅ [Channel Page] WebSocket is now connected!');
  }
}, { immediate: true });

// Update live viewer count based on WebSocket data
const updateLiveViewerCount = () => {
  if (wsBrain && wsBrain.isConnected && wsBrain.liveStreams?.length > 0) {
    liveViewerCount.value = wsBrain.liveStreams.reduce((total, stream) => {
      if (stream.channel === menuTitle.value) {
        return total + (stream.viewers || 0);
      }
      return total;
    }, 0);
  }
};

// Enhanced display items with live status
const enhancedDisplayItems = computed(() => {
  return displayItems.value.map(item => ({
    ...item,
    isLive: isItemLive(item)
  }));
});

onMounted(async () => {
  // Always scroll to top when page loads - aggressive approach for both desktop and mobile
  if (process.client) {
    // Disable browser scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    
    // Immediate scroll to top
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Force scroll to top multiple times to ensure it works
    const forceScrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      
      // Also try scrolling the main container
      const mainContainer = document.querySelector('body > div');
      if (mainContainer) {
        mainContainer.scrollTop = 0;
        mainContainer.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
      
      // Force scroll on all scrollable elements
      const scrollableElements = document.querySelectorAll('*');
      scrollableElements.forEach(element => {
        if (element.scrollTop > 0) {
          element.scrollTop = 0;
        }
      });
    };
    
    // Execute immediately
    forceScrollToTop();
    
    // Execute after a short delay
    setTimeout(forceScrollToTop, 50);
    
    // Execute after page is fully rendered
    setTimeout(forceScrollToTop, 100);
    
    // Execute after a longer delay to catch any late layout changes
    setTimeout(forceScrollToTop, 300);
    
    // Use requestAnimationFrame for smooth execution
    requestAnimationFrame(forceScrollToTop);
    
    // Use nextTick to ensure Vue has finished updating the DOM
    await nextTick();
    forceScrollToTop();
    
    // Also handle any scroll events that might interfere
    const preventScrollInterference = () => {
      if (window.scrollY > 0) {
        forceScrollToTop();
      }
    };
    
    // Listen for scroll events and force back to top if needed
    window.addEventListener('scroll', preventScrollInterference, { passive: false });
    
    // Clean up after 1 second
    setTimeout(() => {
      window.removeEventListener('scroll', preventScrollInterference);
    }, 1000);
    
    // Final aggressive scroll after everything is loaded
    setTimeout(forceScrollToTop, 500);
    
    // One more attempt after 1 second
    setTimeout(forceScrollToTop, 1000);
  }

  // Initialize WebSocket connection for real-time content using plugin
  if (process.client) {
    const { $switchToChannel, $getWebSocketState } = useNuxtApp();
    
    // Get the channel owner (creator) from route params
    const { creator, series } = route.params;
    console.log('🔌 [Channel Page] Using persistent WebSocket connection...');
    console.log('🔍 [Channel Page] Channel owner:', creator);
    
    // Switch to this channel using the plugin
    $switchToChannel(creator);
    
    // Log current state
    const state = $getWebSocketState();
    console.log('🔍 [Channel Page] WebSocket state:', state);
    
    console.log('✅ [Channel Page] WebSocket connected for channel:', creator);
  }

  

  console.log('[Clean URL Share] PAGE LOADED');
  console.log('[Clean URL Share] Current URL:', window.location.href);
  console.log('[Clean URL Share] Route params:', route.params);
  console.log('[Clean URL Share] Route query:', route.query);
  
  try {
    const { creator, series } = route.params;
    
    console.log('[Clean URL Share] Extracted params:', { creator, series });
    
    if (!creator || !series) {
      console.error('[Clean URL Share] Missing required parameters');
      error.value = 'Invalid URL structure. Please check the link and try again.';
      return;
    }

    // Get the original share parameters by username and series using Pinia store
    console.log('[Clean URL Share] Fetching share parameters for:', creator, series);
    let shareParams;
    
    try {
      shareParams = await shareStore.fetchShareParams(creator, series);
      console.log('[Clean URL Share] Share parameters:', shareParams);
    } catch (error) {
      console.error('[Clean URL Share] Error fetching share parameters:', error);
      // For development, use fallback parameters if share params don't exist
      console.log('[Clean URL Share] Using fallback parameters for development');
      shareParams = {
        originalEmail: `${creator}@twilly.com`,
        originalSeries: series,
        originalPosterUrl: `https://d4idc5cmwxlpy.cloudfront.net/public/series-posters/${creator}@twilly.com/${series}/poster.jpeg`,
        title: series,
        description: `${series} content by ${creator}`
      };
    }

    // Use the original parameters from the database (or fallback)
    const userEmail = shareParams.originalEmail;
    const originalSeries = shareParams.originalSeries;
    const originalPosterUrl = shareParams.originalPosterUrl;
    const title = shareParams.title;
    const description = shareParams.description;

    // Set the menu title and description
    menuTitle.value = title || decodeURIComponent(series);
    
    // Try to get description from channel store first
    try {
      const storeDescription = await channelStore.getChannelDescription(
        null, // channelId - we'll let the API find it by name and username
        originalSeries,
        userEmail
      );
      menuDescription.value = storeDescription || description || `Check out this menu from ${decodeURIComponent(series)}`;
    } catch (error) {
      console.error('Error loading channel description:', error);
      menuDescription.value = description || `Check out this menu from ${decodeURIComponent(series)}`;
    }
    
    // Use the original poster URL
    posterUrl.value = originalPosterUrl;

    // Fetch menu items using the original email and series
    const apiUrl = `/api/menu-items?email=${encodeURIComponent(userEmail)}&series=${encodeURIComponent(originalSeries)}`;
    console.log('[Clean URL Share] Calling API endpoint:', apiUrl);
    
    const response = await fetch(apiUrl);
    
    console.log('[Clean URL Share] API response status:', response.status);
    
    if (!response.ok) {
      console.error('[Clean URL Share] Failed to fetch menu items');
      error.value = 'Failed to load menu items. Please try again.';
      return;
    }

    const data = await response.json();
    
    // Log the raw API response
    console.log('[Clean URL Share] Raw API data:', data);
    
    // Simple filter: exclude any item with .jpg or .jpeg in URL or filename
    const filteredItems = data.filter(item => {
      const url = item.url || '';
      const fileName = item.fileName || item.title || '';
      
      // Skip if URL or filename contains .jpg or .jpeg
      if (url.includes('.jpg') || url.includes('.jpeg') || 
          fileName.includes('.jpg') || fileName.includes('.jpeg')) {
        console.log('[Clean URL Share] Excluding .jpg/.jpeg file:', fileName, url);
        return false;
      }
      
      console.log('[Clean URL Share] Including item:', fileName);
      return true;
    });
    
    // Log the final filtered list
    console.log('[Clean URL Share] Final filtered items:', filteredItems);
    
    menuItems.value = filteredItems;
    isLoading.value = false;
    
    // Update live viewer count after content loads
    updateLiveViewerCount();
  } catch (error) {
    console.error('[Clean URL Share] Error:', error);
    error.value = 'An unexpected error occurred. Please try again.';
    isLoading.value = false;
  }
});

// Watch for WebSocket content updates
watch(() => wsBrain.liveStreams, (newStreams) => {
  if (newStreams && newStreams.length > 0) {
    console.log('Live streams updated:', newStreams);
    updateLiveViewerCount();
  }
}, { deep: true });

watch(() => wsBrain.channels, (newChannels) => {
  if (newChannels && newChannels.length > 0) {
    console.log('Channels updated:', newChannels);
  }
}, { deep: true });

watch(() => wsBrain.recentEpisodes, (newEpisodes) => {
  if (newEpisodes && newEpisodes.length > 0) {
    console.log('Recent episodes updated:', newEpisodes);
  }
}, { deep: true });
</script> 

<style scoped>
/* Ensure page starts at absolute top */
:deep(html), :deep(body) {
  scroll-behavior: auto !important;
  scroll-padding-top: 0 !important;
  scroll-margin-top: 0 !important;
}

/* Force the main container to start at top */
:deep(body > div) {
  scroll-margin-top: 0 !important;
  scroll-padding-top: 0 !important;
}

/* Ensure no default scroll positioning */
:deep(*) {
  scroll-margin-top: 0 !important;
  scroll-padding-top: 0 !important;
}
</style> 