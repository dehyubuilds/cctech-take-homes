<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155]">
    <!-- Real-time Status Indicator -->
    <div v-if="wsBrain && wsBrain.isConnected" class="fixed top-4 right-4 z-50 bg-black/80 backdrop-blur-sm border border-teal-500/30 rounded-xl p-3 shadow-xl max-w-[120px] sm:max-w-none">
      <div class="flex items-center gap-2">
        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
        <span class="text-xs text-teal-300 font-medium">LIVE</span>
        <span class="text-xs text-gray-400 hidden sm:inline">{{ liveViewerCount }} watching</span>
      </div>
    </div>





    <!-- Hero / Poster -->
    <div class="relative h-[48vh] w-full overflow-hidden">
      <img :src="heroImage" class="w-full h-full object-cover" :alt="title" />
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
      <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
        <div class="max-w-6xl mx-auto">
          <h1 class="text-white text-3xl sm:text-5xl font-bold mb-2">{{ title }}</h1>
          <p class="text-gray-300 text-sm sm:text-base">{{ subtitle }}</p>
        </div>
      </div>
    </div>

    <!-- Back to Home Navigation -->
    <div class="max-w-6xl mx-auto px-4 py-4">
      <NuxtLink 
        to="/"
        class="inline-flex items-center gap-2 text-teal-300 hover:text-teal-200 transition-colors duration-200 font-medium"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
        </svg>
        <span>Back to Home</span>
      </NuxtLink>
    </div>

    <!-- Body -->
    <div class="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div class="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
        <h2 class="text-white text-lg sm:text-xl font-semibold mb-3">About this channel</h2>
        <p class="text-gray-300 text-sm sm:text-base">
          {{ description }}
        </p>
      </div>

      <!-- Trailer Section -->
      <div v-if="trailerUrl" class="relative overflow-hidden">
        <!-- Premium Trailer Container -->
        <div class="bg-gradient-to-br from-black/40 via-gray-900/60 to-black/40 backdrop-blur-sm border border-white/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <!-- Trailer Header -->
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-xl flex items-center justify-center border border-red-500/30">
                <svg class="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <div>
                <h2 class="text-white text-xl sm:text-2xl font-bold">Official Trailer</h2>
                <p class="text-gray-400 text-sm">Get a preview of what's coming</p>
              </div>
            </div>
            <div class="hidden sm:flex items-center gap-2 text-xs text-gray-400">
              <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>HD Quality</span>
            </div>
          </div>

          <!-- Premium Video Player -->
          <div class="relative group">
            <div class="relative w-full bg-black rounded-xl overflow-hidden shadow-2xl" style="padding-bottom: 56.25%;">
              <video 
                :src="trailerUrl" 
                controls 
                class="absolute top-0 left-0 w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.02]"
                preload="metadata"
                poster=""
                style="filter: brightness(0.9) contrast(1.1);"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>

          <!-- Trailer Info Footer -->
          <div class="mt-6 flex items-center justify-between">
            <div class="flex items-center gap-4 text-sm text-gray-400">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>Premium Quality</span>
              </div>
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span>4K Ready</span>
              </div>
            </div>
            <div class="text-xs text-gray-500">
              Click to expand controls
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <button
          @click="viewChannel"
          :disabled="isNavigating"
          class="px-5 py-3 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg v-if="isNavigating" class="animate-spin h-5 w-5 text-teal-300" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <span>{{ isNavigating ? 'Opening…' : 'View Channel' }}</span>
        </button>
        

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue';
// Twilly channel icons mapping
const TWILLY_CHANNEL_ICONS = {
  'twilly': '/assets/channels/icon-512.png',
  'twilly-after-dark': '/assets/channels/icon-512.png',
  'twilly-fit': '/assets/channels/twilly-fit-icon.png',
  'twilly-game-zone': '/assets/channels/twilly-game-zone-icon.png',
  'twilly-music-stream': '/assets/channels/twilly-music-stream-icon.png',
  'twilly-tech-stream': '/assets/channels/twilly-tech-stream-icon.png'
};
import { useRoute } from 'vue-router';
import { useTalentRequestsStore } from '@/stores/talentRequests';
import { useWebSocketBrain } from '~/stores/WebSocketBrain';
import { useChannelDescriptionStore } from '~/stores/useChannelDescriptionStore';

const route = useRoute();
const username = route.params.username;
const channelSlug = route.params.channel;

// Initialize talent requests store for channel poster loading
const talentRequestsStore = useTalentRequestsStore();

// Initialize WebSocket store for real-time features
const wsBrain = useWebSocketBrain();

// Initialize channel store for descriptions
const channelStore = useChannelDescriptionStore();

// WebSocket reactive data
const liveViewerCount = ref(42); // Mock data for testing
const liveItems = ref([
  { id: 'item1', title: 'Live Stream 1' },
  { id: 'item2', title: 'Live Stream 2' }
]); // Mock data for testing


// Watch for WebSocket connection changes
watch(() => wsBrain.isConnected, (connected) => {
  console.log('🔍 [Channel Page] WebSocket connection status changed:', connected);
  if (connected) {
    console.log('✅ [Channel Page] WebSocket is now connected!');
  }
}, { immediate: true });

// Watch for WebSocket data updates
watch(() => wsBrain.liveStreams, (streams) => {
  console.log('🔍 [Channel Page] Live streams updated:', streams);
  if (streams && streams.length > 0) {
    liveViewerCount.value = streams.reduce((total, stream) => total + (stream.viewers || 0), 0);
  }
}, { deep: true });



const deslugify = (value) => {
  if (!value) return '';
  try { return decodeURIComponent(String(value)).replace(/-/g, ' '); } catch { return String(value).replace(/-/g, ' '); }
};
const slugify = (value) => {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const normalizePosterUrl = (url) => {
  if (!url) return '';
  let fixed = url;
  try { fixed = decodeURIComponent(url); } catch (_) {}
  if (fixed.includes('d4idc5cmwxlpy.cloudfront.net')) {
    fixed = fixed.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
  }
  if (fixed.includes('/series-posters/') && !fixed.includes('/public/series-posters/')) {
    fixed = fixed.replace('/series-posters/', '/public/series-posters/');
  }
  return fixed;
};

// Load channel poster using the same logic as talent request page
const loadChannelPoster = async () => {
  try {
    console.log('Loading channel poster for:', { username, channel: deslugify(channelSlug) });
    
    // Use the same public API that the talent request page uses
    await talentRequestsStore.loadPublicRequestsByChannel(username, deslugify(channelSlug));
    
    console.log('Channel poster loaded:', talentRequestsStore.channelPosterUrl);
  } catch (error) {
    console.error('Error loading channel poster:', error);
  }
};

// Fetch series/share params by username + series name
let fetched = null;
try {
  fetched = await $fetch('/api/creators/get-share-params', {
    method: 'POST',
    body: { username, series: deslugify(channelSlug) }
  });
} catch (e) {
  console.error('[PreviewPage] get-share-params failed:', e);
}

// If the first call failed or returned default poster, try with exact channel name from response
if (fetched && fetched.title && fetched.originalPosterUrl && fetched.originalPosterUrl.includes('default-poster.jpg')) {
  try {
    console.log('[PreviewPage] Retrying with exact channel name:', fetched.title);
    fetched = await $fetch('/api/creators/get-share-params', {
      method: 'POST',
      body: { username, series: fetched.title }
    });
  } catch (e) {
    console.error('[PreviewPage] Retry with exact name failed:', e);
  }
}

const title = computed(() => fetched?.title || deslugify(channelSlug) || 'Channel');
// Subtitle - Always uses the default format for consistency
const subtitle = computed(() => {
  const creatorUsername = fetched?.resolvedUsername || username;
  return `Check out this series from ${creatorUsername}`;
});

// Channel description - Uses custom description from DynamoDB if available
const description = computed(() => {
  const channelName = deslugify(channelSlug);
  const creatorUsername = fetched?.resolvedUsername || username;
  
  console.log('🔍 [Channel Page] Channel description computed:', {
    channelName,
    creatorUsername,
    username,
    fetchedDescription: fetched?.description,
    fallbackDescription: `Check out this series from ${creatorUsername}`
  });
  
  // Use the custom description from the API response (which fetches from DynamoDB)
  if (fetched?.description) {
    console.log('✅ [Channel Page] Using custom description from API:', fetched.description);
    return fetched.description;
  }
  
  // Fallback to default subtitle format
  const fallbackDescription = `Check out this series from ${creatorUsername}`;
  console.log('⚠️ [Channel Page] Using fallback description:', fallbackDescription);
  return fallbackDescription;
});
const poster = computed(() => {
  // Prioritize the API response first (most accurate)
  if (fetched?.originalPosterUrl) {
    return normalizePosterUrl(fetched.originalPosterUrl);
  }
  
  // Fallback to talent requests store if no API response
  if (talentRequestsStore.channelPosterUrl) {
    return normalizePosterUrl(talentRequestsStore.channelPosterUrl);
  }
  
  // Final fallback to default poster
  return normalizePosterUrl('https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg');
});

// For Twilly channels, use local assets so previews are reliable across platforms
const isTwillyChannel = computed(() => {
  const slug = (channelSlug || '').toLowerCase();
  console.log('Checking if Twilly channel:', { slug, availableKeys: Object.keys(TWILLY_CHANNEL_ICONS) });
  return Object.keys(TWILLY_CHANNEL_ICONS).includes(slug);
});

const heroImage = computed(() => {
  const slug = (channelSlug || '').toLowerCase();
  const iconPath = TWILLY_CHANNEL_ICONS[slug];
  console.log('Hero image computed:', { slug, iconPath, fallback: poster.value });
  
  // Always prioritize the poster from API response (no hardcoded values)
  // Only use hardcoded assets if no poster is available from API
  if (poster.value) {
    return poster.value;
  }
  
  // Final fallback to hardcoded assets only if no API poster
  return iconPath || 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
});

const ogImage = computed(() => heroImage.value);

// Trailer URL from API response
const trailerUrl = computed(() => {
  return fetched?.trailerUrl || null;
});

useHead({
  title: title.value,
  meta: [
    { property: 'og:title', content: title.value },
    { property: 'og:description', content: subtitle.value },
    { property: 'og:image', content: ogImage.value },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: route.fullPath },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title.value },
    { name: 'twitter:description', content: subtitle.value },
    { name: 'twitter:image', content: ogImage.value }
  ],
  link: [{ rel: 'canonical', href: route.fullPath }]
});

// Click handler: shorten and redirect to long URL
const isNavigating = ref(false);
const viewChannel = async () => {
  try {
    isNavigating.value = true;
    // Always use exact-cased series title from backend when available
    const seriesName = fetched?.title || deslugify(channelSlug);
    const seriesEncoded = encodeURIComponent(seriesName);
    const posterEncoded = poster.value ? encodeURIComponent(poster.value) : '';
    const query = `title=${encodeURIComponent(seriesName)}&description=${encodeURIComponent(subtitle.value)}`;
    const longUrl = posterEncoded
      ? `/menu/share/${username}/${seriesEncoded}/${posterEncoded}?${query}`
      : `/menu/share/${username}/${seriesEncoded}?${query}`;

    // Direct redirect (skip shortener per request)
    window.location.href = longUrl;
  } catch (e) {
    console.error('[PreviewPage] viewChannel error:', e);
    const seriesName = fetched?.title || deslugify(channelSlug);
    const seriesEncoded = encodeURIComponent(seriesName);
    const posterEncoded = poster.value ? encodeURIComponent(poster.value) : '';
    const query = `title=${encodeURIComponent(seriesName)}&description=${encodeURIComponent(subtitle.value)}`;
    const longUrl = posterEncoded
      ? `/menu/share/${username}/${seriesEncoded}/${posterEncoded}?${query}`
      : `/menu/share/${username}/${seriesEncoded}?${query}`;
    window.location.href = longUrl;
  }
};

// Load channel poster when component mounts
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

  // Load channel poster
  await loadChannelPoster();

  // Description is now loaded directly from the fetched object in the computed property
  console.log('🔍 [Channel Page] Fetched data:', {
    title: fetched?.title,
    description: fetched?.description,
    resolvedUsername: fetched?.resolvedUsername,
    originalPosterUrl: fetched?.originalPosterUrl
  });

  // Initialize WebSocket connection for real-time content using plugin
  if (process.client) {
    const { $switchToChannel, $getWebSocketState } = useNuxtApp();
    
    console.log('🔌 [Channel Page] Using persistent WebSocket connection...');
    console.log('🔍 [Channel Page] Channel owner:', username);
    
    // Switch to this channel using the plugin
    $switchToChannel(username);
    
    // Log current state
    const state = $getWebSocketState();
    console.log('🔍 [Channel Page] WebSocket state:', state);
    
    console.log('✅ [Channel Page] WebSocket connected for channel:', username);
  }
});

// Description is now loaded directly from the API, so no need for complex store watching
// The description will automatically update when the page is refreshed
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


