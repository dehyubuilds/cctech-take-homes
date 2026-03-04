<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] pt-16">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center items-center h-64">
      <div class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mb-4"></div>
        <p class="text-gray-400">Loading content...</p>
      </div>
    </div>

    <!-- Content (only shown when loaded) -->
    <div v-else class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <!-- Header Section -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl sm:text-4xl font-bold text-white mb-2 bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {{ menuTitle }}
            </h1>
            <p class="text-gray-300 text-sm sm:text-base font-medium">
              {{ menuDescription }}
            </p>
          </div>
        </div>
      </div>

      <!-- Back to Channels Navigation -->
      <div class="mb-6 relative z-10">
        <NuxtLink 
          to="/" 
          class="inline-flex items-center gap-2 text-teal-300 hover:text-teal-200 transition-colors duration-200 font-medium px-4 py-2 rounded-lg hover:bg-teal-500/10 cursor-pointer"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          <span>Back to Channels</span>
        </NuxtLink>
      </div>

      <!-- Poster Image -->
      <div class="mb-8">
        <div class="relative w-full h-64 sm:h-80 lg:h-96 rounded-2xl overflow-hidden shadow-2xl">
          <div v-if="imageLoading" class="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
          </div>
          <img 
            v-if="posterUrl && !imageError" 
            :src="posterUrl" 
            class="w-full h-full object-cover"
            :alt="menuTitle"
            @error="handleImageError"
            @load="handleImageLoad"
          />
          <div v-else class="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <Icon name="heroicons:photo" class="w-16 h-16 text-gray-400" />
          </div>
        </div>
      </div>

      <!-- Menu Items Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div 
          v-for="item in menuItemsComputed" 
          :key="item.SK"
          class="bg-gradient-to-br from-white/5 via-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
        >
          <!-- Video Thumbnail -->
          <div class="relative mb-4">
            <div class="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden">
              <video 
                v-if="item.category === 'Videos'"
                :src="item.url" 
                class="w-full h-full object-cover"
                preload="metadata"
                @click="playVideo(item)"
              />
              <img 
                v-else-if="item.category === 'Images'"
                :src="item.url" 
                class="w-full h-full object-cover"
                @click="viewImage(item)"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Icon name="heroicons:document" class="w-12 h-12 text-gray-400" />
              </div>
            </div>
            
            <!-- Play Button Overlay -->
            <div v-if="item.category === 'Videos'" class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
              <div class="bg-black/50 rounded-full p-4">
                <Icon name="heroicons:play" class="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <!-- Item Info -->
          <div>
            <h3 class="text-lg font-semibold text-white mb-2 truncate">{{ item.name }}</h3>
            <p class="text-gray-400 text-sm mb-3">{{ formatFileSize(item.size) }}</p>
            
            <!-- Action Buttons -->
            <div class="flex gap-2">
              <button 
                @click="downloadFile(item)"
                class="flex-1 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-300 border border-teal-500/30 rounded-xl px-3 py-2 text-sm hover:from-teal-500/30 hover:to-cyan-500/30 transition-all duration-300"
              >
                <Icon name="heroicons:arrow-down-tray" class="w-4 h-4 inline mr-1" />
                Download
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- No Content Message -->
      <div v-if="menuItemsComputed.length === 0" class="text-center py-12">
        <Icon name="heroicons:folder-open" class="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 class="text-xl font-semibold text-white mb-2">No Content Available</h3>
        <p class="text-gray-400">This channel doesn't have any public content yet.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFileStore } from '~/stores/useFileStore';
import { useAuthStore } from '~/stores/auth';

// Apply social meta middleware
definePageMeta({
  middleware: ['social-meta']
});

// Store instances
const fileStore = useFileStore();
const authStore = useAuthStore();

// Route and router
const route = useRoute();
const router = useRouter();

// Reactive data
const isLoading = ref(true);
const imageLoading = ref(true);
const imageError = ref(false);
const posterUrl = ref('');
const menuTitle = ref('');
const menuDescription = ref('');

// Get URL parameters
const username = route.params.username;
const series = route.params.series;
const poster = route.params.poster; // This will be an array with the poster URL parts
console.log('[Poster] Route params extracted:', { username, series, poster });

// Extract poster URL from the poster parameter array
let posterUrlFromRoute = null;
if (poster && Array.isArray(poster) && poster.length > 0) {
  // Join the poster URL parts and decode
  const posterPath = poster.join('/');
  console.log('[Poster] Poster path before decoding:', posterPath);
  try {
    posterUrlFromRoute = decodeURIComponent(posterPath);
    console.log('[Poster] Extracted poster URL from route:', posterUrlFromRoute);
    
    // IMMEDIATE FIX: Add /public/ prefix if missing
    if (posterUrlFromRoute.includes('d3hv50jkrzkiyh.cloudfront.net/series-posters/')) {
      posterUrlFromRoute = posterUrlFromRoute.replace('d3hv50jkrzkiyh.cloudfront.net/series-posters/', 'd3hv50jkrzkiyh.cloudfront.net/public/series-posters/');
      console.log('[Poster] IMMEDIATE FIX: Added /public/ prefix:', posterUrlFromRoute);
    }
  } catch (error) {
    console.error('[Poster] Error decoding poster URL:', error);
  }
} else {
  console.log('[Poster] No poster array found in route params');
}

// Get the poster URL directly from the route parameter (like working pages)
const posterUrlFromRouteComputed = computed(() => {
  console.log('[Poster] posterUrlFromRouteComputed called with posterUrlFromRoute:', posterUrlFromRoute);
  if (!posterUrlFromRoute) {
    console.log('[Poster] No posterUrlFromRoute, returning null');
    return null;
  }
  
  // Fix the CloudFront domain if needed
  let url = posterUrlFromRoute;
  console.log('[Poster] Initial URL:', url);
  if (url.includes('d4idc5cmwxlpy.cloudfront.net')) {
    url = url.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
    console.log('[Poster] Fixed CloudFront domain:', url);
  }
  
  // Fix the poster URL to include /public/ prefix if missing
  if (url.includes('d3hv50jkrzkiyh.cloudfront.net') && !url.includes('/public/')) {
    url = url.replace('/series-posters/', '/public/series-posters/');
    console.log('[Poster] Fixed URL to include /public/ prefix:', url);
  }
  
  // Hardcoded fix: Always ensure /public/ prefix is present
  if (url.includes('d3hv50jkrzkiyh.cloudfront.net/series-posters/')) {
    url = url.replace('d3hv50jkrzkiyh.cloudfront.net/series-posters/', 'd3hv50jkrzkiyh.cloudfront.net/public/series-posters/');
    console.log('[Poster] Hardcoded fix applied:', url);
  }
  
  console.log('[Poster] Final computed URL:', url);
  return url;
});

// Fetch poster URL from API for clean URL format
const fetchPosterUrl = async () => {
  console.log('[Poster] fetchPosterUrl function called');
  try {
    console.log('[Username/Series] Using poster URL from route parameter:', { username, series, posterUrlFromRoute });
    
    // Use the poster URL from the route parameter (like working pages)
    if (posterUrlFromRouteComputed.value) {
      const url = posterUrlFromRouteComputed.value;
      console.log('[Username/Series] Using computed poster URL:', url);
      
      // Use direct URL for display (not proxy)
      posterUrl.value = url;
      console.log('[Username/Series] Final poster URL set:', posterUrl.value);
      imageLoading.value = true;
      
      // FINAL CHECK: Ensure /public/ prefix is present
      if (posterUrl.value.includes('d3hv50jkrzkiyh.cloudfront.net/series-posters/')) {
        posterUrl.value = posterUrl.value.replace('d3hv50jkrzkiyh.cloudfront.net/series-posters/', 'd3hv50jkrzkiyh.cloudfront.net/public/series-posters/');
        console.log('[Username/Series] FINAL CHECK: Fixed poster URL:', posterUrl.value);
      }
      
      // Final check: If the URL still doesn't have /public/, force it
      if (posterUrl.value.includes('d3hv50jkrzkiyh.cloudfront.net/series-posters/')) {
        posterUrl.value = posterUrl.value.replace('d3hv50jkrzkiyh.cloudfront.net/series-posters/', 'd3hv50jkrzkiyh.cloudfront.net/public/series-posters/');
        console.log('[Username/Series] Final forced fix applied:', posterUrl.value);
      }
    } else {
      // Try to get the poster URL from the folder data (like managefiles.vue does)
      console.log('[Poster] No poster in route, trying to get from folder data');
      const currentFolder = fileStore.folders?.find(f => f.name === series);
      if (currentFolder && currentFolder.seriesPosterUrl) {
        console.log('[Poster] Found folder with seriesPosterUrl:', currentFolder.seriesPosterUrl);
        
        // Use the same logic as managefiles.vue
        let url = currentFolder.seriesPosterUrl.replace('/series-posters/', '/public/series-posters/');
        url = url.replace('d4idc5cmwxlpy.cloudfront.net', 'd3hv50jkrzkiyh.cloudfront.net');
        
        posterUrl.value = url;
        console.log('[Poster] Using poster URL from folder data:', posterUrl.value);
        imageLoading.value = true;
      } else {
        // Fallback to default poster
        posterUrl.value = 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
        console.log('[Username/Series] Using default poster URL:', posterUrl.value);
        imageLoading.value = true;
      }
    }
    
    console.log('[Username/Series] Poster URL set, meta tags should update');
  } catch (error) {
    console.error('[Username/Series] Error setting poster URL:', error);
    // Fallback to default poster
    posterUrl.value = 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
    imageLoading.value = true;
  }
};

// Fetch creator content
const fetchCreatorContent = async () => {
  try {
    console.log('[Poster] Fetching creator content for username:', username);
    
    // Get email for username
    const email = await getEmailForUsername(username);
    console.log('[Poster] Found email for username:', username, '→', email);
    
    if (!email) {
      console.error('[Poster] No email found for username:', username);
      return;
    }
    
    console.log('[Poster] Final email to use:', email);
    
    // Fetch files for the creator
    await fileStore.getFiles(email);
    
    // Fetch poster URL for clean URL format
    console.log('[Poster] About to call fetchPosterUrl...');
    await fetchPosterUrl();
    console.log('[Poster] fetchPosterUrl completed, posterUrl.value is now:', posterUrl.value);
    
    // For clean URL format, we don't have a poster parameter, so we need to get the email differently
    
    // For clean URL format, we don't have a poster parameter, so we need to get the email differently
    const emailForUsername = await getEmailForUsername(username);
    if (emailForUsername) {
      // Set menu title and description from query parameters or defaults
      menuTitle.value = route.query.title || decodeURIComponent(series);
      menuDescription.value = route.query.description || `Check out this series from ${username}`;
    }
    
    isLoading.value = false;
  } catch (error) {
    console.error('[Poster] Error fetching creator content:', error);
    isLoading.value = false;
  }
};

// Get email for username
const getEmailForUsername = async (username) => {
  try {
    const response = await $fetch('/api/creators/get', {
      method: 'POST',
      body: { username }
    });
    
    if (response.success && response.creator) {
      return response.creator.email;
    }
  } catch (error) {
    console.error('[Poster] Error getting email for username:', error);
  }
  return null;
};

// Computed properties
const menuItemsComputed = computed(() => {
  if (!fileStore.files || fileStore.files.length === 0) return [];
  
  return fileStore.files.filter(file => {
    console.log('=== VISIBILITY DEBUG ===');
    console.log('File:', file.name);
    console.log('isVisible:', file.isVisible);
    console.log('airdate:', file.airdate);
    console.log('category:', file.category);
    
    // Show files that are explicitly visible
    if (file.isVisible === true) {
      console.log('✓ Showing visible file:', file.name);
      return true;
    }
    
    // Show scheduled files with future airdates
    if (file.isVisible === false && file.airdate) {
      const airdate = new Date(file.airdate);
      const now = new Date();
      if (airdate > now) {
        console.log('✓ Showing scheduled file with future airdate:', file.name);
        return true;
      }
    }
    
    // Hide non-visible files
    console.log('✗ Hiding non-visible file:', file.name);
    return false;
  });
});

// File utilities
const formatFileSize = (bytes) => {
  if (!bytes) return 'Unknown size';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

// Event handlers
const handleImageError = (error) => {
  console.error('Error loading image:', error);
  imageError.value = true;
  imageLoading.value = false;
};

const handleImageLoad = () => {
  imageLoading.value = false;
  imageError.value = false;
};

const playVideo = (item) => {
  // Open video in new tab or modal
  window.open(item.url, '_blank');
};

const viewImage = (item) => {
  // Open image in new tab
  window.open(item.url, '_blank');
};

const downloadFile = (item) => {
  // Create a temporary link and trigger download
  const link = document.createElement('a');
  link.href = item.url;
  link.download = item.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Meta tags for social sharing
const currentUrl = computed(() => {
  if (process.client) {
    return window.location.href;
  }
  return '';
});

// Get optimized OG image for social sharing
const getOptimizedOGImage = computed(() => {
  const seriesName = decodeURIComponent(series).toLowerCase();
  
  // Channel-specific local assets for guaranteed WhatsApp/Instagram compatibility
  // Only add channels that have dedicated local assets
  const localAssets = {
    'twilly after dark': '/assets/channels/twilly-after-dark-og.png',
    'cooking channel': '/assets/channels/cooking-og.png',
    'fitness stream': '/assets/channels/fitness-og.png',
    'gaming network': '/assets/channels/gaming-og.png',
    'default': '/assets/twilly-logo-streaming.png'
  };
  
  // Check if this specific channel has a local asset
  const hasLocalAsset = localAssets[seriesName];
  const localAsset = hasLocalAsset || localAssets['default'];
  const dynamicPoster = posterUrl.value || 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
  
  console.log('[Poster] Channel:', seriesName);
  console.log('[Poster] Has local asset:', !!hasLocalAsset);
  console.log('[Poster] Local asset:', localAsset);
  console.log('[Poster] Dynamic poster:', dynamicPoster);
  
  // For channels with local assets, use local as primary
  // For channels without local assets, use dynamic poster as primary
  return {
    primary: hasLocalAsset ? localAsset : dynamicPoster,
    fallback: hasLocalAsset ? dynamicPoster : localAssets['default']
  };
});

const posterUrlForMeta = computed(() => {
  return posterUrl.value || 'https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/default/default-poster.jpg';
});

// Set meta tags immediately with optimized images
const ogImages = getOptimizedOGImage.value;

// Server-side meta tag generation for social crawlers
useHead({
  title: route.query.title || decodeURIComponent(series),
  meta: [
    { property: 'og:title', content: route.query.title || decodeURIComponent(series) },
    { property: 'og:description', content: route.query.description || `Check out this series from ${username}` },
    // Primary image for WhatsApp/Instagram compatibility
    { property: 'og:image', content: ogImages.primary },
    // Fallback image for other platforms
    { property: 'og:image:url', content: ogImages.fallback },
    { property: 'og:url', content: currentUrl.value },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: route.query.title || decodeURIComponent(series) },
    { name: 'twitter:description', content: route.query.description || `Check out this series from ${username}` },
    { name: 'twitter:image', content: ogImages.primary },
    // Additional meta tags for better social sharing
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:type', content: 'image/png' },
    { name: 'twitter:image:alt', content: route.query.title || decodeURIComponent(series) }
  ]
});

// Watch for poster URL changes to update meta tags
watch(posterUrl, (newValue) => {
  if (newValue) {
    useHead({
      meta: [
        { property: 'og:image', content: newValue },
        { name: 'twitter:image', content: newValue }
      ]
    });
  }
});

// Initialize on mount
onMounted(async () => {
  console.log('[Poster] Page mounted with route params:', route.params);
  console.log('[Poster] Username from route:', route.params.username);
  console.log('[Poster] Series from route:', route.params.series);
  console.log('[Poster] Query params:', route.query);
  console.log('[Poster] Initial posterUrl.value:', posterUrl.value);
  
  await fetchCreatorContent();
});

// Watch for poster URL changes
watch(posterUrl, (newValue, oldValue) => {
  console.log('[Poster] posterUrl changed from:', oldValue, 'to:', newValue);
});
</script>
