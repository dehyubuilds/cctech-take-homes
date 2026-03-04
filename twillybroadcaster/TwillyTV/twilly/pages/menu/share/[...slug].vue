<template>
    <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <!-- Real-time Status Indicator -->
    <div v-if="wsBrain && wsBrain.isConnected" class="fixed top-4 right-4 z-50 bg-black/80 backdrop-blur-sm border border-teal-500/30 rounded-xl p-3 shadow-xl max-w-[120px] sm:max-w-none">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
        <span class="text-xs text-teal-300 font-medium">LIVE</span>
        <span class="text-xs text-gray-400 hidden sm:inline">{{ liveViewerCount }} watching</span>
      </div>
    </div>





    <!-- Header with Poster -->
    <div class="relative h-[50vh] w-full overflow-hidden">
      <div v-if="isLoading" class="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-400 border-t-transparent mb-4"></div>
          <p class="text-white text-lg font-medium">Loading channel content...</p>
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
    <div class="max-w-7xl mx-auto px-4 py-4 relative z-10">
      <NuxtLink 
        to="/channel-guide"
        class="inline-flex items-center gap-2 text-teal-300 hover:text-teal-200 transition-colors duration-200 font-medium px-4 py-2 rounded-lg hover:bg-teal-500/10 cursor-pointer"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
        </svg>
        <span>Back to Channels</span>
      </NuxtLink>
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
             class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 overflow-hidden hover:border-teal-500/50 transition-all duration-300">
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
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useFileStore } from '~/stores/useFileStore';
import { useWebSocketBrain } from '~/stores/WebSocketBrain';

const route = useRoute();
const fileStore = useFileStore();

// Initialize WebSocket store for real-time features
const wsBrain = useWebSocketBrain();

const isLoading = ref(true);
const error = ref(null);
const menuItems = ref([]);
const menuTitle = ref('');
const menuDescription = ref('');
const posterUrl = ref('');
const userEmail = ref('');
const series = ref('');

// WebSocket reactive data
const liveViewerCount = ref(42); // Mock data for testing
const liveItems = ref([
  { id: 'item1', title: 'Live Stream 1' },
  { id: 'item2', title: 'Live Stream 2' }
]); // Mock data for testing


// Watch for WebSocket connection changes (with debounce to prevent excessive logging)
let lastConnectionState = null;
watch(() => wsBrain.isConnected, (connected) => {
  // Only log if the state actually changed
  if (lastConnectionState !== connected) {
    lastConnectionState = connected;
    if (connected) {
      console.log('✅ [Menu Share] WebSocket connected');
    }
  }
}, { immediate: true });

// Watch for WebSocket data updates
watch(() => wsBrain.liveStreams, (streams) => {
  if (streams && streams.length > 0) {
    liveViewerCount.value = streams.reduce((total, stream) => total + (stream.viewers || 0), 0);
  }
}, { deep: true });



// Watch for changes to menuItems (logging removed to prevent console spam)
watch(menuItems, (newItems) => {
  // Items updated - no logging to prevent excessive console output
}, { deep: true });

onMounted(async () => {
  console.log('🚀 [Menu Share] PAGE LOADED - Updated code is running!');
  console.log('🚀 [Menu Share] Current URL:', window.location.href);
  console.log('🚀 [Menu Share] Route params:', route.params);
  console.log('🚀 [Menu Share] Route query:', route.query);
  console.log('🚀 [Menu Share] This is the [...slug].vue file being used!');
  
  try {
    // Get the full slug array and reconstruct parameters
    const slugArray = route.params.slug || [];
    console.log('[Menu Share] Full slug array:', slugArray);
    
    let posterUrlFromParams, title, description;
    
    if (slugArray.length === 2) {
      // Clean format: /menu/share/username/series
      const username = slugArray[0];
      series.value = slugArray[1];
      
      console.log('[Menu Share] Clean format detected:', { username, series });
      
      // Fetch metadata from DynamoDB using SHARE_PARAMS
      try {
        console.log('[Menu Share] Fetching share params for:', { username, series });
        const shareParams = await $fetch('/api/creators/get-share-params', {
          method: 'POST',
          body: { username, series },
        });
        
        console.log('[Menu Share] Share params from DB:', shareParams);
        
        userEmail.value = shareParams.originalEmail;
        posterUrlFromParams = shareParams.originalPosterUrl;
        title = shareParams.title || series;
        description = shareParams.description || `Check out this menu from ${series}`;
      } catch (error) {
        console.error('[Menu Share] Error fetching share params:', error);
        error.value = 'Failed to load menu metadata. Please check the URL and try again.';
        return;
      }
      
    } else if (slugArray.length >= 3) {
      // Old format: /menu/share/email/series/poster?title=...&description=...
      const userId = slugArray[0];
      series.value = slugArray[1];
      const poster = slugArray[2];
      
      console.log('[Menu Share] Old format detected:', { userId, series, poster });
    
    if (!userId || !series || !poster) {
      console.error('[Menu Share] Missing required parameters');
        error.value = 'Missing required parameters. Please check the URL and try again.';
      return;
    }

    // Get user details from Creators table
      console.log('[Menu Share] Fetching user details for userId:', userId);
    const userData = await $fetch('/api/creators/get', {
      method: 'POST',
      body: { userId },
    });

    console.log('[Menu Share] User data:', userData);
      userEmail.value = userData.email;

    // Set the menu title and description from query parameters
      title = route.query.title || decodeURIComponent(series);
      description = route.query.description || `Check out this menu from ${decodeURIComponent(series)}`;
    
      // Fix poster URL construction - handle both encoded and decoded URLs
      let posterPath = poster;
      
      // If the poster path contains a full URL, extract just the path part
      if (posterPath.includes('http')) {
        try {
          const url = new URL(posterPath);
          posterPath = url.pathname;
        } catch (e) {
          console.warn('[Menu Share] Could not parse poster URL, using as-is:', posterPath);
        }
      }
      
      // Decode the poster path
      posterPath = decodeURIComponent(posterPath);
      console.log('[Menu Share] Decoded poster path:', posterPath);
      
      // Keep the 'public' prefix - it's required for the image to load
      // The poster URL should include /public/ prefix
      if (!posterPath.includes('public/') && posterPath.includes('series-posters/')) {
        posterPath = posterPath.replace('series-posters/', 'public/series-posters/');
        console.log('[Menu Share] Added /public/ prefix to poster path:', posterPath);
      }
    
    // Set the poster URL
      posterUrlFromParams = `https://d3hv50jkrzkiyh.cloudfront.net/${posterPath}`;
      console.log('[Menu Share] Initial poster URL:', posterUrlFromParams);
      
      // Ensure the poster URL has the /public/ prefix
      if (posterUrlFromParams.includes('d3hv50jkrzkiyh.cloudfront.net/series-posters/')) {
        posterUrlFromParams = posterUrlFromParams.replace('d3hv50jkrzkiyh.cloudfront.net/series-posters/', 'd3hv50jkrzkiyh.cloudfront.net/public/series-posters/');
        console.log('[Menu Share] Fixed poster URL with /public/ prefix:', posterUrlFromParams);
      }
      
      console.log('[Menu Share] Final poster URL:', posterUrlFromParams);
      
    } else {
      console.error('[Menu Share] Invalid slug array length:', slugArray.length);
      error.value = 'Invalid URL structure. Please check the link and try again.';
      return;
    }
    
    // Set the menu title and description
    menuTitle.value = title || decodeURIComponent(series);
    menuDescription.value = description || `Check out this menu from ${decodeURIComponent(series)}`;
    
    // Set the poster URL
    console.log('[Menu Share] Setting posterUrl.value to:', posterUrlFromParams);
    posterUrl.value = posterUrlFromParams;
    console.log('[Menu Share] posterUrl.value is now:', posterUrl.value);
    
    // Check if poster exists, if not use a default
    try {
      const posterResponse = await fetch(posterUrl.value, { method: 'HEAD' });
      if (!posterResponse.ok) {
        // Use a default poster image
        posterUrl.value = 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
      }
    } catch (error) {
      console.error('Error checking poster:', error);
      // Use a default poster image
      posterUrl.value = 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
    }

    // Fetch menu items using the email - using $fetch like managefiles.vue
    const apiUrl = `/api/menu-items?email=${encodeURIComponent(userEmail)}&series=${encodeURIComponent(series)}`;
    console.log('[Menu Share] About to call API endpoint:', apiUrl);
    console.log('[Menu Share] userEmail:', userEmail);
    console.log('[Menu Share] series:', series);
    
    try {
      console.log('[Menu Share] Making $fetch call...');
      const data = await $fetch(apiUrl);
      console.log('[Menu Share] $fetch call successful!');
      console.log('[Menu Share] Raw API data:', data);
      console.log('[Menu Share] Data type:', typeof data);
      console.log('[Menu Share] Data length:', Array.isArray(data) ? data.length : 'Not an array');
    } catch (fetchError) {
      console.error('[Menu Share] $fetch call failed:', fetchError);
      console.error('[Menu Share] Error details:', {
        message: fetchError.message,
        status: fetchError.status,
        statusText: fetchError.statusText,
        data: fetchError.data
      });
      throw fetchError;
    }
    

    const itemsToFilter = data.items || data; // Support both new and old formats
    
    // Simple filter: exclude any item with .jpg or .jpeg in URL or filename
    const filteredItems = itemsToFilter.filter(item => {
      const url = item.url || '';
      const fileName = item.fileName || item.title || '';
      
      // Skip if URL or filename contains .jpg or .jpeg
      if (url.includes('.jpg') || url.includes('.jpeg') || 
          fileName.includes('.jpg') || fileName.includes('.jpeg')) {
        console.log('[Menu Share] Excluding .jpg/.jpeg file:', fileName, url);
        return false;
      }
      
      console.log('[Menu Share] Including item:', fileName);
      return true;
    });
    
    // Log the final filtered list
    console.log('[Menu Share] Final filtered items:', filteredItems);
    
    // Set menu items regardless of response format
    menuItems.value = filteredItems;
    console.log('[Menu Share] menuItems.value set to:', menuItems.value);

    // Set up metadata for link previews
    useHead({
      title: menuTitle.value,
      meta: [
        {
          hid: 'description',
          name: 'description',
          content: menuDescription.value,
        },
        {
          hid: 'og:title',
          property: 'og:title',
          content: menuTitle.value,
        },
                {
          hid: 'og:description',
          property: 'og:description',
          content: menuDescription.value,
        },
        {
          hid: 'og:image',
          property: 'og:image',
          content: 'https://twilly.app/assets/twilly-logo-og.png',
        },
        {
          hid: 'twitter:card',
          name: 'twitter:card',
          content: 'summary_large_image',
        },
      ],
    });
  } catch (error) {
    console.error('[Menu Share] Error fetching menu items:', error);
    error.value = error.message;
  } finally {
    isLoading.value = false;
  }

  // Initialize WebSocket connection for real-time content using plugin
  if (process.client) {
    const { $switchToChannel } = useNuxtApp();
    
    // Get the channel owner from route params
    const channelOwner = route.params.slug?.[0] || 'guest';
    
    // Switch to this channel using the plugin
    $switchToChannel(channelOwner);
  }
});

// Computed property to filter out .jpg items from display (double protection)
const displayItems = computed(() => {
  return menuItems.value.filter(item => {
    const url = item.url || '';
    const thumbnailUrl = item.thumbnailUrl || '';
    const fileName = item.fileName || item.title || '';
    
    // Skip if main URL, thumbnail URL, or filename contains .jpg or .jpeg
    if (url.includes('.jpg') || url.includes('.jpeg') || 
        thumbnailUrl.includes('.jpg') || thumbnailUrl.includes('.jpeg') ||
        fileName.includes('.jpg') || fileName.includes('.jpeg')) {
      console.log('[Menu Share] Template filter: Excluding .jpg item:', fileName);
      return false;
    }
    return true;
  });
});
</script>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}

/* Add line clamping for descriptions */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style> 