<template>
  <div class="min-h-screen bg-black text-white">
    <!-- Mobile-First Header -->
    <div class="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-gray-800">
      <div class="flex items-center justify-between px-4 py-3">
        <!-- Logo -->
        <button 
          @click="navigateTo('/')"
          class="flex items-center gap-3 hover:opacity-80 transition-opacity duration-200"
        >
          <div class="w-8 h-8 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-lg flex items-center justify-center">
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
        </button>
        
        <!-- Auth Buttons -->
        <div class="flex items-center gap-2">
          <button 
            v-if="!authStore.authenticated"
            @click="navigateTo('/signin')"
            class="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Sign In
          </button>
          <button 
            v-if="!authStore.authenticated"
            @click="navigateTo('/channel-guide')"
            class="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all"
          >
            Explore
          </button>
          <button 
            v-if="authStore.authenticated"
            @click="navigateTo(authStore.userType === 'creator' ? '/profile' : '/channel-guide')"
            class="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-sm font-medium rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all"
          >
            {{ authStore.userType === 'creator' ? 'Studio' : 'Channels' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Hero Section - Mobile First -->
    <div class="relative px-4 py-16 sm:py-20 min-h-[calc(100vh-80px)] flex items-center justify-center">
      <!-- Background Effects - Always Visible -->
      <div class="absolute inset-0 overflow-hidden">
        <div class="absolute top-10 left-4 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl animate-pulse bg-effect-1"></div>
        <div class="absolute top-20 right-8 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl animate-pulse delay-1000 bg-effect-2"></div>
        <div class="absolute bottom-20 left-1/2 w-40 h-40 bg-teal-400/5 rounded-full blur-3xl animate-pulse delay-2000 bg-effect-3"></div>
      </div>

      <div class="relative z-10 text-center max-w-4xl mx-auto w-full">
        <!-- Logo + Brand Name -->
        <div class="flex items-center justify-center gap-3 mb-6">
          <div class="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-lg flex items-center justify-center shadow-lg">
            <div class="flex items-end gap-0.5 h-6">
              <div class="w-0.5 bg-black rounded-sm bar-1" style="height: 8px; animation: stream-pulse 1.5s ease-in-out infinite;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-2" style="height: 12px; animation: stream-pulse 1.5s ease-in-out infinite 0.1s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-3" style="height: 16px; animation: stream-pulse 1.5s ease-in-out infinite 0.2s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-4" style="height: 10px; animation: stream-pulse 1.5s ease-in-out infinite 0.3s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-5" style="height: 9px; animation: stream-pulse 1.5s ease-in-out infinite 0.4s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-6" style="height: 14px; animation: stream-pulse 1.5s ease-in-out infinite 0.5s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-7" style="height: 6px; animation: stream-pulse 1.5s ease-in-out infinite 0.6s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-8" style="height: 15px; animation: stream-pulse 1.5s ease-in-out infinite 0.7s;"></div>
              <div class="w-0.5 bg-black rounded-sm bar-9" style="height: 8px; animation: stream-pulse 1.5s ease-in-out infinite 0.8s;"></div>
            </div>
          </div>
          <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold text-white">Twilly</h2>
        </div>

        <!-- Main Headline -->
        <h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-white mb-6 leading-tight">
          The Best <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-500">F'n</span> Streamers Network, Period.
        </h1>
        
        <!-- Subtitle -->
        <p class="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed px-4">
          Where creators stream, viewers discover, and content comes alive. No ads, no limits, just pure entertainment.
        </p>

        <!-- Live Stats -->
        <div class="flex items-center justify-center gap-4 sm:gap-6 mb-10 text-xs sm:text-sm text-gray-400">
          <div class="flex items-center gap-1 sm:gap-2">
            <div 
              class="w-2 h-2 rounded-full animate-pulse"
              :class="liveStreamCount > 0 ? 'bg-green-500' : 'bg-red-500'"
            ></div>
            <span>{{ liveStreamCount }} Live</span>
          </div>
          <div class="flex items-center gap-1 sm:gap-2">
            <Icon name="heroicons:users" class="w-3 h-3 sm:w-4 sm:h-4" />
            <span>{{ totalViewers }} Watching</span>
          </div>
          <div class="flex items-center gap-1 sm:gap-2">
            <Icon name="heroicons:tv" class="w-3 h-3 sm:w-4 sm:h-4" />
            <span>{{ channelCount }} Channels</span>
          </div>
        </div>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <button 
            @click="navigateTo('/channel-guide')"
            class="px-6 sm:px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-teal-500/25 text-base sm:text-lg min-h-[48px]"
          >
            <div class="flex items-center justify-center gap-2">
              <Icon name="heroicons:play" class="w-5 h-5" />
              Start Watching
            </div>
          </button>
          
          <button 
            v-if="!authStore.authenticated"
            @click="navigateTo('/signin')"
            class="px-6 sm:px-8 py-4 bg-transparent text-teal-300 border-2 border-teal-500/50 rounded-xl hover:bg-teal-500/10 hover:border-teal-400 transition-all duration-300 font-bold text-base sm:text-lg min-h-[48px]"
          >
            <div class="flex items-center justify-center gap-2">
              <Icon name="heroicons:user-plus" class="w-5 h-5" />
              Join Twilly
            </div>
          </button>
        </div>

        <!-- Social Proof -->
        <div class="text-center">
          <p class="text-gray-400 text-xs sm:text-sm mb-4">Trusted by creators worldwide</p>
          <div class="flex items-center justify-center gap-6 sm:gap-8 opacity-60">
            <div class="text-lg sm:text-2xl font-bold text-gray-500">10K+</div>
            <div class="text-lg sm:text-2xl font-bold text-gray-500">Creators</div>
            <div class="text-lg sm:text-2xl font-bold text-gray-500">1M+</div>
            <div class="text-lg sm:text-2xl font-bold text-gray-500">Viewers</div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { Auth } from "aws-amplify";
import { useAuthStore } from "~/stores/auth";
import { useRoute } from 'vue-router';
import { useWebSocketBrain } from '~/stores/WebSocketBrain';
import { generate } from "lean-qr";

import logo from "@/assets/twilly-logo-square.png";

const title = ref("The Best F'n Streamers Network, Period.");
const description = ref("Where creators stream, viewers discover, and content comes alive. No ads, no limits, just pure entertainment. Join the best F'n streamers network.");
const ogImageUrl = logo;

// QR Code functionality
const qrCanvas = ref(null);
const collaborationFormUrl = 'https://twilly.app/collaborate';

// Generate QR code for collaboration form
const generateQRCode = () => {
  if (qrCanvas.value) {
    const blackRGBA = [0, 0, 0, 255];
    const whiteRGBA = [255, 255, 255, 255];
    const qrConfig = {
      on: blackRGBA,
      off: whiteRGBA,
    };
    
    const code = generate(collaborationFormUrl, {
      size: 192, // 48 * 4 for high quality
    });
    
    const canvas = qrCanvas.value;
    canvas.width = 192;
    canvas.height = 192;
    code.toCanvas(canvas, qrConfig);
  }
};

// Open collaboration form
const openCollaborationForm = () => {
  window.open(collaborationFormUrl, '_blank');
};

// Add useHead for meta tags
useHead({
  title: title.value,
  meta: [
    {
      hid: 'description',
      name: 'description',
      content: description.value
    },
    {
      hid: 'og:title',
      property: 'og:title',
      content: title.value
    },
    {
      hid: 'og:description',
      property: 'og:description',
      content: description.value
    },
    {
      hid: 'og:image',
      property: 'og:image',
      content: ogImageUrl
    },
    {
      hid: 'og:image:width',
      property: 'og:image:width',
      content: '512'
    },
    {
      hid: 'og:image:height',
      property: 'og:image:height',
      content: '512'
    },
    {
      hid: 'og:image:type',
      property: 'og:image:type',
      content: 'image/png'
    },
    {
      hid: 'og:image:alt',
      property: 'og:image:alt',
      content: 'Twilly Streaming Network Logo'
    },
    {
      hid: 'og:type',
      property: 'og:type',
      content: 'website'
    },
    {
      hid: 'og:url',
      property: 'og:url',
      content: 'https://twilly.app'
    },
    {
      hid: 'twitter:card',
      name: 'twitter:card',
      content: 'summary_large_image'
    },
    {
      hid: 'twitter:title',
      name: 'twitter:title',
      content: title.value
    },
    {
      hid: 'twitter:description',
      name: 'twitter:description',
      content: description.value
    },
    {
      hid: 'keywords',
      name: 'keywords',
      content: 'premium streaming, subscription network, fitness content, gaming content, music content, tech content, adult entertainment, curated content, ad-free streaming, professional content'
    }
  ]
});

const authStore = useAuthStore();
const wsBrain = useWebSocketBrain();
const isLoading = ref(true);
const route = useRoute();
const showCheckoutModal = ref(false)
const pendingPurchase = ref(null)

// Live stats
const liveStreamCount = ref(127);
const totalViewers = ref(2847);
const channelCount = ref(0);


// Channel data
const availableChannels = ref([]);
const isLoadingChannels = ref(false);

// Live content state
const liveContent = ref([
  {
    id: 1,
    title: "Live Fitness Session",
    channel: "Twilly Fit",
    viewers: 156,
    isLive: true
  },
  {
    id: 2,
    title: "Gaming Tournament",
    channel: "Twilly Game Zone", 
    viewers: 89,
    isLive: true
  },
  {
    id: 3,
    title: "Music Performance",
    channel: "Twilly Music Stream",
    viewers: 234,
    isLive: true
  }
]);

// Computed properties for WebSocket data
const hasLiveContent = computed(() => {
  return wsBrain?.liveStreams?.length > 0 ||
         wsBrain?.featuredContent?.length > 0 ||
         wsBrain?.recentEpisodes?.length > 0 ||
         wsBrain?.channels?.length > 0;
});


// Channel live status checker
const isChannelLive = (channelName) => {
  return wsBrain?.liveStreams?.some(stream => 
    stream.channel?.toLowerCase().includes(channelName.toLowerCase())
  ) || false;
};



// Watch for changes in auth state
watch(() => authStore.authenticated, (newVal) => {
  if (newVal && authStore.user) {
    const isProducer = authStore.user?.attributes?.email || authStore.user?.username?.includes('@');
    console.log('Auth state changed in home.vue:', {
      isAuthenticated: authStore.authenticated,
      isProducer,
      user: authStore.user
    });
  }
}, { immediate: true });

// Update the watch for auth state changes
watch(() => authStore.isAuthenticated, async (isAuthenticated) => {
  if (isAuthenticated) {
    console.log('User is authenticated, checking return URL...');
    const returnUrl = route.query.returnUrl;
    const purchaseItem = route.query.purchaseItem;
    
    if (returnUrl && purchaseItem) {
      console.log('Found return URL and purchase item, redirecting...');
      // Preserve all query parameters and add verified flag
      const query = {
        ...route.query,
        verified: 'true',
        purchaseItem,
        returnUrl
      };
      
      // Store purchase details in localStorage for persistence
      if (process.client) {
        localStorage.setItem('pendingPurchase', JSON.stringify({
          itemId: purchaseItem,
          returnUrl: returnUrl
        }));
      }
      
      await navigateTo({
        path: returnUrl,
        query
      });
    }
  }
}, { immediate: true });

// Watch for WebSocket content updates
watch(() => wsBrain?.featuredContent, (newContent) => {
  if (newContent && newContent.length > 0) {
    console.log('Featured content updated:', newContent);
  }
}, { deep: true });

watch(() => wsBrain?.channels, (newChannels) => {
  if (newChannels && newChannels.length > 0) {
    console.log('Channels updated:', newChannels);
  }
}, { deep: true });

watch(() => wsBrain?.liveStreams, (newStreams) => {
  if (newStreams && newStreams.length > 0) {
    console.log('Live streams updated:', newStreams);
  }
}, { deep: true });

watch(() => wsBrain?.recentEpisodes, (newEpisodes) => {
  if (newEpisodes && newEpisodes.length > 0) {
    console.log('Recent episodes updated:', newEpisodes);
  }
}, { deep: true });

// Load public channels (same as channel-guide.vue)
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
      
      // Update channel count
      channelCount.value = availableChannels.value.length;
    } else {
      // No public channels found - show empty state instead of fallback demo channels
      availableChannels.value = [];
      channelCount.value = 0;
    }
  } catch (error) {
    console.error('Error loading public channels:', error);
    availableChannels.value = [];
    channelCount.value = 0;
  } finally {
    isLoadingChannels.value = false;
  }
};

// Update live stats from WebSocket data
watch(() => wsBrain?.liveStreams, (newStreams) => {
  if (newStreams && newStreams.length > 0) {
    liveStreamCount.value = newStreams.length;
    totalViewers.value = newStreams.reduce((total, stream) => total + (stream.viewers || 0), 0);
  }
}, { deep: true });

watch(() => wsBrain?.channels, (newChannels) => {
  if (newChannels && newChannels.length > 0) {
    channelCount.value = newChannels.length;
  }
}, { deep: true });

// Initialize auth state on mount
onMounted(async () => {
  // Load public channels first
  await loadPublicChannels();
  
  // Initialize WebSocket connection for real-time content
    if (process.client) {
      const { $getWebSocketState } = useNuxtApp();
      
      // For home page, we use the default connection (no specific channel)
      console.log('🔌 [Home Page] Using persistent WebSocket connection...');
      
      // Log current state
      const state = $getWebSocketState();
      console.log('🔍 [Home Page] WebSocket state:', state);
      
      console.log('✅ [Home Page] WebSocket connected for home page');
    }
  
  // Generate QR code for collaboration
  if (process.client) {
    // Wait for next tick to ensure DOM is ready
    await nextTick();
    generateQRCode();
  }
  
  if (process.client) {
    try {
      
      // First check if we already have auth state
      if (authStore.authenticated && authStore.user) {
        console.log('Using existing auth state:', {
          isAuthenticated: authStore.authenticated,
          userType: authStore.userType,
          user: authStore.user
        });
        
        // Check for pending purchases
        checkPendingPurchase()
        
        isLoading.value = false;
        return;
      }

      // If no auth state, try to get from AWS
      const user = await Auth.currentAuthenticatedUser();
      if (user) {
        console.log('Cognito User:', user);
        // Check if user has email in attributes or username
        const isCreator = user?.attributes?.email || user?.username?.includes('@');
        if (isCreator) {
          authStore.authenticated = true;
          authStore.user = user;
          authStore.userType = 'creator';
          console.log('User is a creator');
          
          // If we have a return URL and purchase item, redirect to login
          if (route.query.returnUrl && route.query.purchaseItem) {
            console.log('Creator logged in, redirecting to login page');
            navigateTo({
              path: '/login',
              query: {
                returnUrl: route.query.returnUrl,
                purchaseItem: route.query.purchaseItem
              }
            });
          }
        } else {
          authStore.authenticated = true;
          authStore.user = user;
          authStore.userType = 'buyer';
          console.log('User is a buyer');
          
          // If we have a return URL and purchase item, return to purchase page
          if (route.query.returnUrl && route.query.purchaseItem) {
            console.log('Buyer authenticated, returning to purchase page');
            navigateTo(route.query.returnUrl);
          }
        }
      } else {
        // If no AWS user, try to initialize from localStorage
        await authStore.initializeAuth();
        
        // If we have a return URL and purchase item, check user type
        if (route.query.returnUrl && route.query.purchaseItem) {
          if (authStore.userType === 'buyer') {
            console.log('Buyer authenticated, returning to purchase page');
            navigateTo(route.query.returnUrl);
          } else {
            console.log('No buyer logged in, redirecting to login page');
            navigateTo({
              path: '/login',
              query: {
                returnUrl: route.query.returnUrl,
                purchaseItem: route.query.purchaseItem
              }
            });
          }
        }
      }
    } catch (error) {
      console.log('No authenticated user found');
      // Try to initialize from localStorage
      await authStore.initializeAuth();
      
      // If we have a return URL and purchase item, check user type
      if (route.query.returnUrl && route.query.purchaseItem) {
        if (authStore.userType === 'buyer') {
          console.log('Buyer authenticated, returning to purchase page');
          navigateTo(route.query.returnUrl);
        } else {
          console.log('No buyer logged in, redirecting to login page');
          navigateTo({
            path: '/login',
            query: {
              returnUrl: route.query.returnUrl,
              purchaseItem: route.query.purchaseItem
            }
          });
        }
      }
    } finally {
      isLoading.value = false;
    }
  }
});

const handleGetStarted = () => {
  navigateTo('/');
};

const logout = async () => {
  try {
    await Auth.signOut();
    await authStore.loggedOut();
    console.log('Logout successful - forcing page reload');
    // Force a full page reload to ensure proper rendering on mobile
    if (process.client) {
      window.location.href = '/';
    }
  } catch (error) {
    console.error("Error in signOut:", error);
  }
};

const scrollToFeatures = () => {
  const featuresSection = document.getElementById('features');
  if (featuresSection) {
    featuresSection.scrollIntoView({ behavior: 'smooth' });
  }
};

const fetchItemDetails = async (itemId) => {
  try {
    // Make API call to get item details
    const response = await $fetch('/api/items/details', {
      method: 'POST',
      body: {
        itemId: itemId
      }
    })

    if (response.success) {
      // Update pendingPurchase with item details
      pendingPurchase.value = {
        ...pendingPurchase.value,
        ...response.item
      }
    }
  } catch (error) {
    console.error('Error fetching item details:', error)
    showCheckoutModal.value = false
  }
}

const checkPendingPurchase = async () => {
  if (process.client) {
    const storedPurchase = localStorage.getItem('pendingPurchase');
    if (storedPurchase) {
      try {
        const purchase = JSON.parse(storedPurchase);
        console.log('Found pending purchase:', purchase);
        pendingPurchase.value = purchase;
        
        // Fetch item details before showing modal
        await fetchItemDetails(purchase.itemId);
        showCheckoutModal.value = true;
        
        // Clear the stored purchase
        localStorage.removeItem('pendingPurchase');
      } catch (error) {
        console.error('Error processing pending purchase:', error);
        localStorage.removeItem('pendingPurchase');
      }
    }
  }
};

const confirmPurchase = async () => {
  try {
    if (!pendingPurchase.value) return;
    
    // Here you would typically make an API call to verify the payment
    // For now, we'll just show a success message and redirect
    showCheckoutModal.value = false;
    
    // Redirect to the purchased content page
    await navigateTo('/dashboard');
  } catch (error) {
    console.error('Error confirming purchase:', error);
  }
};

// Feature Modal State
const showModal = ref(false);
const modalData = ref({
  title: '',
  icon: '',
  color: '',
  description: '',
  requirements: [],
  steps: [],
  benefits: []
});

const showFeatureModal = (feature) => {
  // Modal functionality removed - no longer needed
};

const closeFeatureModal = () => {
  showModal.value = false;
  modalData.value = {
    title: '',
    icon: '',
    color: '',
    description: '',
    requirements: [],
    steps: [],
    benefits: []
  };
};

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

/* Modern gradient backgrounds */
.bg-gradient-to-r {
  background-size: 200% 200%;
  animation: gradientShift 3s ease infinite;
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Streaming bars animation */
@keyframes stream-pulse {
  0%, 100% {
    transform: scaleY(0.3);
    opacity: 0.7;
  }
  50% {
    transform: scaleY(1);
    opacity: 1;
  }
}

/* Background effects animation */
@keyframes bg-pulse {
  0%, 100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

.bg-effect-1,
.bg-effect-2,
.bg-effect-3 {
  animation: bg-pulse 4s ease-in-out infinite;
}

.bg-effect-2 {
  animation-delay: 1s;
}

.bg-effect-3 {
  animation-delay: 2s;
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

/* Mobile-optimized text */
@media (max-width: 640px) {
  h1 {
    font-size: 2.5rem;
    line-height: 1.1;
  }
  
  .text-lg {
    font-size: 1.125rem;
    line-height: 1.5;
  }
}

/* Enhanced hover states for desktop */
@media (hover: hover) {
  .group:hover .group-hover\:scale-105 {
    transform: scale(1.05);
  }
}

/* Remove hover effects on touch devices */
@media (hover: none) {
  .hover\:scale-105:hover {
    transform: none;
  }
  
  .hover\:from-teal-600:hover {
    background: inherit;
  }
  
  .hover\:to-cyan-600:hover {
    background: inherit;
  }
}

/* Mobile-specific improvements */
@media (max-width: 640px) {
  /* Improve text readability on mobile */
  h1, h2, h3 {
    word-wrap: break-word;
    hyphens: auto;
    line-height: 1.2;
  }
  
  /* Better spacing for mobile */
  .space-y-3 > * + * {
    margin-top: 0.75rem;
  }
  
  /* Improve modal scrolling on mobile */
  .overflow-y-auto {
    -webkit-overflow-scrolling: touch;
  }
  
  /* Optimize grid layouts for mobile */
  .grid {
    gap: 1rem;
  }
  
  /* Better padding for mobile */
  .p-4 {
    padding: 1rem;
  }
  
  /* Improve button spacing on mobile */
  .gap-3 {
    gap: 0.75rem;
  }
  
  /* Optimize icon sizes for mobile */
  .w-6.h-6 {
    width: 1.5rem;
    height: 1.5rem;
  }
  
  /* Better text sizing for mobile */
  .text-xs {
    font-size: 0.75rem;
    line-height: 1rem;
  }
  
  .text-sm {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
}

/* Smooth scrolling for anchor links */
html {
  scroll-behavior: smooth;
}

/* Prevent horizontal scroll on mobile */
body {
  overflow-x: hidden;
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

/* Optimize text rendering for mobile */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Better touch targets */
button, a {
  cursor: pointer;
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