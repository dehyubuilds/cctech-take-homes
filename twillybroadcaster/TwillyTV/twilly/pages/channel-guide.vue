<template>
  <div class="min-h-screen bg-black text-white">
    <!-- Mobile-First Header -->
    <div class="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-gray-800">
      <div class="flex items-center justify-between px-4 py-3">
        <!-- Back Button -->
        <button 
          @click="navigateTo('/')"
          class="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
        >
          <Icon name="heroicons:arrow-left" class="w-5 h-5" />
          <span class="hidden sm:inline">Back</span>
        </button>
        
        <!-- Title -->
        <h1 class="text-lg font-bold text-white ml-2"></h1>
        
        <!-- Search Input - Desktop Only -->
        <div class="hidden sm:flex flex-1 max-w-xs mx-4">
          <input 
            v-model="searchQuery"
            type="text"
            placeholder="Search channels..."
            class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>

    <!-- Hero Section -->
    <div class="px-4 py-8 sm:py-12">
      <div class="max-w-4xl mx-auto text-center">
        <!-- Twilly Branding -->
        <div class="flex items-center justify-center gap-3 mb-6">
          <div class="w-12 h-12 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-lg flex items-center justify-center">
            <div class="flex items-end gap-0.5 h-4">
              <div class="w-0.5 bg-black rounded-sm bar-1" style="height:6px;animation:stream-pulse 1.5s ease-in-out infinite;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-2" style="height:10px;animation:stream-pulse 1.5s ease-in-out infinite 0.1s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-3" style="height:14px;animation:stream-pulse 1.5s ease-in-out infinite 0.2s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-4" style="height:8px;animation:stream-pulse 1.5s ease-in-out infinite 0.3s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-5" style="height:7px;animation:stream-pulse 1.5s ease-in-out infinite 0.4s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-6" style="height:12px;animation:stream-pulse 1.5s ease-in-out infinite 0.5s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-7" style="height:4px;animation:stream-pulse 1.5s ease-in-out infinite 0.6s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-8" style="height:13px;animation:stream-pulse 1.5s ease-in-out infinite 0.7s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-9" style="height:6px;animation:stream-pulse 1.5s ease-in-out infinite 0.8s;"></div>
            </div>
          </div>
          <h1 class="text-3xl sm:text-4xl font-bold text-white">Twilly</h1>
        </div>
        
        <h2 class="text-2xl sm:text-3xl font-bold text-white mb-4">The Streamer's Network</h2>
        <p class="text-gray-300 text-lg sm:text-xl mb-6">Curated, high-quality episodes from the next wave of streamers</p>
        
        <!-- Search Input - Mobile Only -->
        <div class="sm:hidden mb-6">
          <input 
            v-model="searchQuery"
            type="text"
            placeholder="Search channels..."
            class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="pb-8">
      <!-- Loading State -->
      <div v-if="isLoadingChannels" class="flex justify-center items-center py-20">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
      </div>

      <!-- TV Network Guide -->
      <div v-if="filteredChannels.length > 0" class="max-w-7xl mx-auto px-4">
        <!-- All Channels Grid -->
        <div class="mb-8">
          <h3 class="text-xl font-bold text-white mb-6 flex items-center justify-center gap-2">
            <Icon name="heroicons:tv" class="w-5 h-5 text-teal-400" />
            {{ searchQuery ? 'Search Results' : 'All Channels' }}
          </h3>
          <div class="flex flex-wrap justify-center gap-6">
            <div 
              v-for="channel in filteredChannels" 
              :key="channel.id"
              @click="navigateToChannel(channel)"
              class="channel-card bg-gradient-to-br from-slate-900/80 to-slate-800/60 rounded-xl border border-slate-700/50 hover:border-teal-500/70 hover:shadow-xl hover:shadow-teal-500/20 transition-all duration-300 cursor-pointer group overflow-hidden w-full sm:w-80 lg:w-72 xl:w-80"
            >
              <!-- Channel Thumbnail -->
              <div class="relative aspect-video bg-slate-800 rounded-t-xl overflow-hidden">
                <img 
                  :src="channel.posterUrl" 
                  :alt="channel.name"
                  class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  @error="handleImageError"
                />
                <!-- Live Indicator -->
                <div v-if="channel.isLive" class="absolute top-3 left-3 flex items-center gap-1 bg-red-500 text-white text-xs px-2 py-1 rounded-full shadow-lg">
                  <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  LIVE
                </div>
                <!-- Play Icon -->
                <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div class="w-14 h-14 bg-gradient-to-r from-teal-500/90 to-cyan-500/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl">
                    <Icon name="heroicons:play" class="w-7 h-7 text-white ml-1" />
                  </div>
                </div>
              </div>
              
              <!-- Channel Details -->
              <div class="p-4">
                <h4 class="text-white font-bold text-lg mb-1 truncate">{{ channel.name }}</h4>
                <p class="text-teal-300 text-sm mb-2 truncate font-medium">{{ channel.creator }}</p>
                <p class="text-gray-300 text-sm mb-3 line-clamp-2">{{ channel.description || 'Your personalized streaming network. Add creators you love, curate your timeline, and watch content that matters to you.' }}</p>
                <div class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-4 text-gray-400">
                    <span class="flex items-center gap-1">
                      <Icon name="heroicons:play" class="w-3 h-3 text-teal-400" />
                      {{ channel.episodes || Math.floor(Math.random() * 100) + 10 }} episodes
                    </span>
                    <span class="flex items-center gap-1">
                      <Icon name="heroicons:users" class="w-3 h-3 text-cyan-400" />
                      {{ formatNumber(channel.followers || Math.floor(Math.random() * 10000) + 1000) }}
                    </span>
                  </div>
                  <span v-if="channel.isLive" class="text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded-full">LIVE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="!isLoadingChannels" class="text-center py-20">
        <div class="max-w-md mx-auto">
          <div class="w-24 h-24 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <div class="flex items-end gap-0.5 h-8">
              <div class="w-0.5 bg-teal-400 rounded-sm bar-1" style="height:8px;animation:stream-pulse 1.5s ease-in-out infinite;"></div>
              <div class="w-0.5 bg-teal-400 rounded-sm bar-2" style="height:12px;animation:stream-pulse 1.5s ease-in-out infinite 0.1s;"></div>
              <div class="w-0.5 bg-teal-400 rounded-sm bar-3" style="height:16px;animation:stream-pulse 1.5s ease-in-out infinite 0.2s;"></div>
              <div class="w-0.5 bg-teal-400 rounded-sm bar-4" style="height:10px;animation:stream-pulse 1.5s ease-in-out infinite 0.3s;"></div>
              <div class="w-0.5 bg-teal-400 rounded-sm bar-5" style="height:14px;animation:stream-pulse 1.5s ease-in-out infinite 0.4s;"></div>
            </div>
          </div>
          <h3 class="text-2xl font-semibold text-white mb-4">
            {{ searchQuery ? 'No Channels Found' : 'No Public Channels Broadcasting' }}
          </h3>
          <p class="text-gray-400 mb-8">
            {{ searchQuery ? 'Try adjusting your search terms to find your favorite streamers. Searchable channels (private but searchable) will appear in search results.' : 'The next wave of streamers is preparing their content. Check back soon for curated episodes!' }}
          </p>
          <button 
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all duration-300 shadow-lg shadow-teal-500/25"
          >
            Clear Search
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();

// Channel state
const availableChannels = ref([]);
const isLoadingChannels = ref(false);
const followedChannels = ref(new Set());
const searchQuery = ref('');

// Helper function to remove emojis from a string
const removeEmojis = (str) => {
  if (!str) return str;
  // Remove emojis using regex - matches most emoji ranges
  return str.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{200D}]|[\u{FE00}-\u{FE0F}]/gu, '').trim();
};

// Filtered channels based on search query
const filteredChannels = computed(() => {
  const hasSearchQuery = searchQuery.value.trim().length > 0;
  
  if (!hasSearchQuery) {
    // When no search query: show only public channels
    return availableChannels.value.filter(channel => channel.visibility === 'public');
  }
  
  // When searching: show both public and searchable channels that match
  // Channel name must match exactly (case-insensitive) - no partial matches
  // Emojis are stripped from both the channel name and search query before comparison
  const query = searchQuery.value.trim();
  const queryLower = removeEmojis(query).toLowerCase();
  
  return availableChannels.value.filter(channel => {
    // Must be public or searchable
    if (channel.visibility !== 'public' && channel.visibility !== 'searchable') {
      return false;
    }
    
    // Remove emojis from channel name and compare (case-insensitive, exact match)
    const channelNameClean = removeEmojis(channel.name).toLowerCase();
    return channelNameClean === queryLower;
  });
});

// Navigate to channel using simple slug format (e.g., /tacotuesday)
const navigateToChannel = (channel) => {
  // Create a slug from the channel name (remove emojis, lowercase, replace spaces with hyphens)
  const channelNameClean = removeEmojis(channel.name);
  const channelSlug = channelNameClean.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  
  // Navigate to simple slug format (e.g., /tacotuesday)
  const channelUrl = `/${channelSlug}`;
  
  console.log('Channel URL:', channelUrl);
  navigateTo(channelUrl);
};

// Follow/Unfollow channel
const followChannel = async (channel) => {
  if (followedChannels.value.has(channel.id)) {
    followedChannels.value.delete(channel.id);
  } else {
    followedChannels.value.add(channel.id);
  }
  
  // Here you would typically make an API call to save the follow state
  console.log('Followed channels:', Array.from(followedChannels.value));
};

// Handle image loading errors
const handleImageError = (event) => {
  event.target.style.display = 'none';
};

// Format numbers for display
const formatNumber = (num) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

// Convert S3 URLs to CloudFront URLs (same as managefiles.vue)
const convertToCloudFrontUrl = (url) => {
  if (!url) return url;
  
  // If it's already a CloudFront URL, return as is
  if (url.includes('cloudfront.net')) {
    return url;
  }
  
  // If it's an S3 URL, convert to CloudFront URL
  if (url.includes('s3.amazonaws.com') || url.includes('s3.us-east-1.amazonaws.com')) {
    // Convert S3 URL to CloudFront URL
    const cloudFrontUrl = url.replace(/^https:\/\/[^\/]+\.s3[^\/]*\.amazonaws\.com\//, 'https://d3hv50jkrzkiyh.cloudfront.net/');
    // Ensure it has the /public/ prefix
    if (!cloudFrontUrl.includes('/public/')) {
      return cloudFrontUrl.replace('/series-posters/', '/public/series-posters/');
    }
    return cloudFrontUrl;
  }
  
  return url;
};

// Load public channels
const loadPublicChannels = async () => {
  isLoadingChannels.value = true;
  
  try {
    const response = await $fetch('/api/channels/get-public-channels', {
      method: 'POST',
      body: {}
    });
    
    if (response && response.success && response.channels && response.channels.length > 0) {
      const mappedChannels = response.channels.map(channel => ({
        id: channel.channelId,
        name: channel.channelName,
        creator: channel.creatorUsername || 'Unknown',
        description: channel.description || 'Your personalized streaming network. Add creators you love, curate your timeline, and watch content that matters to you.',
        posterUrl: channel.posterUrl || '/assets/channels/icon-512.png',
        visibility: channel.visibility || (channel.isPublic ? 'public' : 'private'),
        isPublic: channel.isPublic || false,
        isLive: Math.random() > 0.7, // Mock live status
        followers: Math.floor(Math.random() * 10000) + 1000,
        episodes: Math.floor(Math.random() * 100) + 10,
        viewers: Math.floor(Math.random() * 500) + 50,
        recentEpisodes: [] // Will be populated from API later
      }));
      
      // Sort channels to put Twilly TV first
      availableChannels.value = mappedChannels.sort((a, b) => {
        if (a.name.toLowerCase().includes('twilly tv')) return -1;
        if (b.name.toLowerCase().includes('twilly tv')) return 1;
        if (a.name.toLowerCase().includes('twilly after dark')) return 1;
        if (b.name.toLowerCase().includes('twilly after dark')) return -1;
        return a.name.localeCompare(b.name);
      });
    } else {
      // No public channels found - show empty state instead of fallback demo channels
      availableChannels.value = [];
    }
  } catch (error) {
    console.error('Error loading public channels:', error);
    availableChannels.value = [];
  } finally {
    isLoadingChannels.value = false;
  }
};

// Set up meta tags for social sharing
useHead({
  title: 'The Streamer\'s Network - Twilly',
  meta: [
    {
      name: 'description',
      content: 'The online TV network built for the next wave of streamers. Curated, high-quality episodes from the next wave of streamers.'
    },
    {
      property: 'og:title',
      content: 'The Streamer\'s Network - Twilly'
    },
    {
      property: 'og:description',
      content: 'The online TV network built for the next wave of streamers. Curated, high-quality episodes from the next wave of streamers.'
    },
    {
      property: 'og:image',
      content: 'https://twilly.app/assets/twilly-logo-og.png'
    },
    {
      property: 'og:type',
      content: 'website'
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image'
    },
    {
      name: 'twitter:title',
      content: 'The Streamer\'s Network - Twilly'
    },
    {
      name: 'twitter:description',
      content: 'The online TV network built for the next wave of streamers. Curated, high-quality episodes from the next wave of streamers.'
    },
    {
      name: 'twitter:image',
      content: 'https://twilly.app/assets/twilly-logo-og.png'
    }
  ]
});

// Load channels on mount
onMounted(async () => {
  await loadPublicChannels();
});
</script>

<style scoped>
/* Mobile-first responsive design */
.min-h-screen {
  min-height: 100vh;
  min-height: 100dvh; /* Dynamic viewport height for mobile */
}

.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}

/* Twitter-like feed styling */
.border-b {
  border-bottom: 1px solid #1f2937;
}

.hover\:bg-gray-900\/50:hover {
  background-color: rgba(17, 24, 39, 0.5);
}

/* Mobile-optimized text */
@media (max-width: 640px) {
  .text-lg {
    font-size: 1.125rem;
    line-height: 1.5;
  }
  
  .text-sm {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
}

/* Enhanced mobile touch targets */
button {
  min-height: 44px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* Smooth transitions for mobile */
* {
  transition: all 0.2s ease;
}

/* Loading animation */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Pulse animation for live indicators */
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

/* Streaming bars animation */
@keyframes stream-pulse {
  0%, 100% {
    height: 6px;
    opacity: 0.7;
  }
  50% {
    height: 14px;
    opacity: 1;
  }
}

.bar-1 { animation: stream-pulse 1.5s ease-in-out infinite; }
.bar-2 { animation: stream-pulse 1.5s ease-in-out infinite 0.1s; }
.bar-3 { animation: stream-pulse 1.5s ease-in-out infinite 0.2s; }
.bar-4 { animation: stream-pulse 1.5s ease-in-out infinite 0.3s; }
.bar-5 { animation: stream-pulse 1.5s ease-in-out infinite 0.4s; }
.bar-6 { animation: stream-pulse 1.5s ease-in-out infinite 0.5s; }
.bar-7 { animation: stream-pulse 1.5s ease-in-out infinite 0.6s; }
.bar-8 { animation: stream-pulse 1.5s ease-in-out infinite 0.7s; }
.bar-9 { animation: stream-pulse 1.5s ease-in-out infinite 0.8s; }

/* TV Network specific styling */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Ensure consistent channel card background across all devices */
.bg-gradient-to-br {
  background-image: linear-gradient(to bottom right, rgb(15 23 42 / 0.8), rgb(30 41 59 / 0.6)) !important;
}

/* Force consistent background on mobile */
@media (max-width: 640px) {
  .bg-gradient-to-br {
    background-image: linear-gradient(to bottom right, rgb(15 23 42 / 0.8), rgb(30 41 59 / 0.6)) !important;
  }
}

/* Channel card specific styling for consistency */
.channel-card {
  background-image: linear-gradient(to bottom right, rgb(15 23 42 / 0.8), rgb(30 41 59 / 0.6)) !important;
}

/* Ensure mobile consistency */
@media (max-width: 640px) {
  .channel-card {
    background-image: linear-gradient(to bottom right, rgb(15 23 42 / 0.8), rgb(30 41 59 / 0.6)) !important;
  }
}

/* Channel card hover effects */
.group:hover .group-hover\:scale-105 {
  transform: scale(1.05);
}

.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}

/* Featured channel styling */
.bg-gradient-to-br {
  background-image: linear-gradient(to bottom right, var(--tw-gradient-stops));
}

/* Mobile-specific improvements */
@media (max-width: 640px) {
  .ml-15 {
    margin-left: 3.75rem; /* 60px - matches avatar width + gap */
  }
  
  .max-w-2xl {
    max-width: 100%;
  }
  
  .px-4 {
    padding-left: 1rem;
    padding-right: 1rem;
  }
  
  /* Mobile grid adjustments */
  .grid-cols-1 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}

/* Optimize text rendering for mobile */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Better touch feedback */
.touch-manipulation {
  touch-action: manipulation;
}

/* Optimize for mobile browsers */
@media (max-width: 640px) {
  /* Prevent zoom on input focus */
  input, textarea, select {
    font-size: 16px;
  }
  
  /* Better viewport handling */
  .min-h-screen {
    min-height: 100dvh;
  }
  
  /* Simplified mobile optimizations */
  body {
    overscroll-behavior-y: none;
    touch-action: pan-y;
  }
}
</style> 