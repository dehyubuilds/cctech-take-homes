<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155]">
    <!-- Hero Section -->
    <div class="relative overflow-hidden">
      <!-- Background Pattern -->
      <div class="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-violet-500/10"></div>
      
      <!-- Content -->
      <div class="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div class="text-center">
          <!-- Channel Image -->
          <div class="mb-8">
            <div v-if="channelImageUrlRef" class="relative inline-block">
              <img 
                :src="channelImageUrlRef" 
                :alt="`${channelName} Channel`" 
                class="w-32 h-32 object-cover rounded-2xl border-4 border-purple-500/30 shadow-2xl"
                @error="handlePosterError"
              />
              <div class="absolute -bottom-2 -right-2 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                <Icon name="heroicons:user-group" class="w-5 h-5 text-white" />
              </div>
            </div>
            <div v-else class="w-32 h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl border-4 border-purple-500/30 shadow-2xl mx-auto flex items-center justify-center">
              <Icon name="heroicons:user-group" class="w-12 h-12 text-white" />
            </div>
          </div>

          <!-- Main Heading -->
          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            You're invited to be a
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Casting Director
            </span>
            for {{ channelName }}
          </h1>

          <!-- Description -->
          <p class="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Help discover and recruit talented collaborators for this channel. 
            Earn 15% commission on successful talent referrals and build your network.
          </p>

          <!-- Stats -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto">
            <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div class="text-2xl font-bold text-purple-400 mb-1">🎯</div>
              <div class="text-white font-semibold">Find Talent</div>
              <div class="text-gray-400 text-sm">Recruit collaborators</div>
            </div>
            <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div class="text-2xl font-bold text-purple-400 mb-1">💰</div>
              <div class="text-white font-semibold">Earn Commission</div>
              <div class="text-gray-400 text-sm">15% on referrals</div>
            </div>
            <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div class="text-2xl font-bold text-purple-400 mb-1">🌟</div>
              <div class="text-white font-semibold">Build Network</div>
              <div class="text-gray-400 text-sm">Industry connections</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Section -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
        <!-- Authentication Status -->
        <div v-if="authStore.user" class="mb-8 p-6 bg-purple-500/10 border border-purple-500/30 rounded-xl">
          <div class="flex items-center gap-3 mb-2">
            <Icon name="heroicons:check-circle" class="w-5 h-5 text-purple-400" />
            <span class="text-purple-300 font-medium">Ready to Accept</span>
          </div>
          <p class="text-white">You'll be joining as: <span class="font-semibold">{{ authStore.user.attributes?.username || authStore.user.attributes?.email || authStore.user.attributes?.phone_number }}</span></p>
        </div>
        
        <div v-else class="mb-8 p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div class="flex items-center gap-3 mb-2">
            <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-yellow-400" />
            <span class="text-yellow-300 font-medium">Sign In Required</span>
          </div>
          <p class="text-white mb-4">Please sign in to accept this casting director invite and start earning commissions.</p>
          <button
            @click="navigateToSignin"
            class="px-6 py-3 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-all duration-300 font-semibold"
          >
            Sign In to Continue
          </button>
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div class="flex items-center gap-3">
            <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-red-400" />
            <span class="text-red-300">{{ errorMessage }}</span>
          </div>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div class="flex items-center gap-3">
            <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
            <span class="text-green-300">{{ successMessage }}</span>
          </div>
        </div>

        <!-- Accept Button -->
        <button
          @click="acceptInvite"
          :disabled="isSubmitting || !authStore.user"
          class="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          <div v-if="isSubmitting" class="flex items-center justify-center gap-2">
            <Icon name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
            Accepting Invite...
          </div>
          <div v-else class="flex items-center justify-center gap-2">
            <Icon name="heroicons:check" class="w-5 h-5" />
            Accept Casting Director Invite
          </div>
        </button>

        <!-- Additional Info -->
        <div class="mt-6 text-center text-gray-400 text-sm">
          <p>As a casting director, you'll receive unique referral links to recruit talent for this channel.</p>
          <p class="mt-2">You'll earn 15% commission on successful talent sign-ups that become active collaborators.</p>
        </div>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
        <div class="flex items-center gap-4">
          <Icon name="heroicons:arrow-path" class="w-8 h-8 text-purple-400 animate-spin" />
          <span class="text-white text-lg">Loading invite details...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '~/stores/auth';
import { useHead } from '@vueuse/head';

const route = useRoute();
const authStore = useAuthStore();

const inviteCode = route.params.inviteCode;
const channelName = ref('');
const channelImageUrlRef = ref('');
const isLoading = ref(true);
const isSubmitting = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

// No need to filter out Twilly channels - show all channel posters

// Set up meta tags for shareable links (same as collaborator-request page)
const title = computed(() => {
  return channelName.value ? `Casting Director Invite - ${channelName.value}` : 'Casting Director Invite';
});

const description = computed(() => {
  return channelName.value 
    ? `Join as a casting director and earn 15% commission on talent referrals for ${channelName.value} with Twilly!`
    : 'Join as a casting director and earn 15% commission on talent referrals with Twilly!';
});

// Extract query parameters immediately (like collaborator request page)
const query = route.query;
const posterUrl = query.poster ? decodeURIComponent(query.poster) : null;
const creatorFromQuery = query.creator ? decodeURIComponent(query.creator) : null;
const titleFromQuery = query.title ? decodeURIComponent(query.title) : '';

// Set channel name immediately from query parameters (like collaborator request page)
if (titleFromQuery) {
  channelName.value = titleFromQuery;
}

// Channel image URL - use poster from query params or fallback
let channelImageUrl = posterUrl || 'https://d3hv50jkrzkiyh.cloudfront.net/twilly-collab-invite-preview.png';

// Use the poster URL as provided - no filtering for Twilly channels
// All channels should use their actual poster URLs

// Set meta tags synchronously (like collaborator request page)
useHead({
  title: titleFromQuery ? `Casting Director Invite - ${titleFromQuery}` : 'Casting Director Invite',
  meta: [
    {
      hid: 'description',
      name: 'description',
      content: description.value,
    },
    {
      hid: 'og:title',
      property: 'og:title',
      content: titleFromQuery ? `Casting Director Invite - ${titleFromQuery}` : 'Casting Director Invite',
    },
    {
      hid: 'og:description',
      property: 'og:description',
      content: description.value,
    },
    {
      hid: 'og:image',
      property: 'og:image',
      content: channelImageUrl,
    },
    {
      hid: 'og:image:width',
      property: 'og:image:width',
      content: '1200',
    },
    {
      hid: 'og:image:height',
      property: 'og:image:height',
      content: '630',
    },
    {
      hid: 'og:image:type',
      property: 'og:image:type',
      content: 'image/png',
    },
    {
      hid: 'og:image:alt',
      property: 'og:image:alt',
      content: titleFromQuery ? `Casting Director Invite - ${titleFromQuery}` : 'Casting Director Invite',
    },
    {
      hid: 'og:type',
      property: 'og:type',
      content: 'website',
    },
    {
      hid: 'og:url',
      property: 'og:url',
      content: `https://twilly.app${route.fullPath}`,
    },
    {
      hid: 'twitter:card',
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      hid: 'twitter:title',
      name: 'twitter:title',
      content: titleFromQuery ? `Casting Director Invite - ${titleFromQuery}` : 'Casting Director Invite',
    },
    {
      hid: 'twitter:description',
      name: 'twitter:description',
      content: description.value,
    },
    {
      hid: 'twitter:image',
      name: 'twitter:image',
      content: channelImageUrl,
    },
  ],
})

onMounted(async () => {
  try {
    // Extract channel info from query parameters
    console.log('🎬 Casting Director Invite - Query params:', query);
    console.log('🎬 Channel name from query:', channelName.value);
    
    // Set the channel image URL for display (we already set it for meta tags above)
    channelImageUrlRef.value = channelImageUrl;
    
  } catch (error) {
    console.error('Error loading invite details:', error);
  } finally {
    isLoading.value = false;
  }
});

// Meta tags are set synchronously above, no need for watch

const fetchActualChannelPoster = async () => {
  try {
    if (!channelName.value) return;
    
    const creatorUsername = route.query.creator || 'DehSin365';
    
    // Method 1: Use the same logic as managefiles.vue getCurrentChannelPosterUrl()
    // This will get the actual channel poster from the file store
    const posterUrl = await getChannelPosterUrlFromFileStore(channelName.value);
    if (posterUrl) {
      // Test if the poster URL is accessible before using it
      try {
        const response = await fetch(posterUrl, { method: 'HEAD' });
        if (response.ok) {
          channelImageUrl.value = posterUrl;
          console.log('🎬 Casting Director - Using file store poster URL:', posterUrl);
          return;
        } else {
          console.log('🎬 Casting Director - File store poster URL not accessible:', posterUrl, response.status);
        }
      } catch (error) {
        console.log('🎬 Casting Director - Error testing file store poster URL:', posterUrl, error);
      }
    }
    
    // Method 2: Try to construct CloudFront URL for actual channel poster (no local asset filtering)
    // All channels should use their actual posters, including Twilly channels
    const encodedChannelName = encodeURIComponent(channelName.value);
    const cloudFrontBaseUrl = 'https://d3hv50jkrzkiyh.cloudfront.net';
    const posterPath = `public/series-posters/${creatorUsername}/${encodedChannelName}/default-poster.jpg`;
    const cloudFrontUrl = `${cloudFrontBaseUrl}/${posterPath}`;
    
    console.log('🎬 Casting Director - Trying CloudFront URL:', cloudFrontUrl);
    
    // Test if CloudFront URL is accessible
    try {
      const response = await fetch(cloudFrontUrl, { method: 'HEAD' });
      if (response.ok) {
        channelImageUrl.value = cloudFrontUrl;
        console.log('🎬 Casting Director - CloudFront URL works:', cloudFrontUrl);
        return;
      }
    } catch (error) {
      console.log('🎬 Casting Director - CloudFront URL failed, using fallback');
    }
    
    // Method 3: Use default fallback
    channelImageUrl.value = 'https://d3hv50jkrzkiyh.cloudfront.net/twilly-collab-invite-preview.png';
    console.log('🎬 Casting Director - Using default fallback');
    
  } catch (error) {
    console.error('Error fetching actual channel poster:', error);
    // Use default fallback on error
    channelImageUrl.value = 'https://d3hv50jkrzkiyh.cloudfront.net/twilly-collab-invite-preview.png';
  }
};

// Get channel poster URL from file store (same logic as managefiles.vue)
const getChannelPosterUrlFromFileStore = async (channelName) => {
  try {
    // Import the file store to access folders
    const { useFileStore } = await import('~/stores/useFileStore');
    const fileStore = useFileStore();
    
    if (!fileStore?.folders) {
      console.log('🎬 Casting Director - No file store folders available');
      return null;
    }

    // Find the folder with exact match (same logic as managefiles.vue)
    const folderSK = `FOLDER#Mixed#${channelName}`;
    const folder = fileStore.folders.find(f => f?.SK === folderSK);
    
    if (folder && folder.seriesPosterUrl) {
      // Handle both string and object formats for seriesPosterUrl
      const seriesPosterUrl = folder.seriesPosterUrl;
      const url = typeof seriesPosterUrl === 'object' ? seriesPosterUrl.S : seriesPosterUrl;
      
      if (url) {
        // Convert S3 URL to CloudFront URL (same logic as managefiles.vue)
        let convertedUrl = url;
        
        // Replace S3 domain with CloudFront domain
        if (url.includes('twillyinputbucket.s3.us-east-1.amazonaws.com')) {
          convertedUrl = url.replace('twillyinputbucket.s3.us-east-1.amazonaws.com', 'd3hv50jkrzkiyh.cloudfront.net');
          console.log('🎬 Casting Director - Converted S3 to CloudFront:', convertedUrl);
        }
        
        // Handle different URL patterns (same logic as managefiles.vue)
        if (convertedUrl.includes('/series-posters/')) {
          // Replace /series-posters/ with /public/series-posters/
          convertedUrl = convertedUrl.replace('/series-posters/', '/public/series-posters/');
          console.log('🎬 Casting Director - Fixed series-posters path:', convertedUrl);
        } else if (convertedUrl.includes('/videos/')) {
          // Replace /videos/ with /public/videos/
          convertedUrl = convertedUrl.replace('/videos/', '/public/videos/');
          console.log('🎬 Casting Director - Fixed videos path:', convertedUrl);
        } else if (!convertedUrl.includes('public/')) {
          // Generic public prefix insertion
          const parts = convertedUrl.split('/');
          parts.splice(3, 0, 'public'); // Insert 'public' after the domain
          convertedUrl = parts.join('/');
          console.log('🎬 Casting Director - Added generic public prefix:', convertedUrl);
        }
        
        console.log('🎬 Casting Director - Final converted URL:', convertedUrl);
        return convertedUrl;
      }
    }
    
    console.log('🎬 Casting Director - No series poster found in file store for:', channelName);
    return null;
    
  } catch (error) {
    console.error('Error getting channel poster from file store:', error);
    return null;
  }
};

// Handle poster image loading errors
const handlePosterError = (event) => {
  console.log('🎬 Casting Director - Poster image failed to load, using fallback');
  // Clear the image URL so it falls back to the gradient background
  channelImageUrlRef.value = '';
};

const navigateToSignin = () => {
  navigateTo('/signin');
};

const acceptInvite = async () => {
  if (!authStore.user || !inviteCode) return;
  
  try {
    isSubmitting.value = true;
    errorMessage.value = '';
    successMessage.value = '';
    
    // Accept the casting director invite
    const response = await $fetch('/api/casting-directors/accept-invite', {
      method: 'POST',
      body: {
        inviteCode: inviteCode,
        userId: authStore.user.attributes.sub,
        userEmail: authStore.user.attributes.email
      }
    });
    
    if (response.success) {
      successMessage.value = response.message || 'Successfully joined as casting director!';
      console.log('Casting director invite accepted successfully');
      
      // Redirect to profile after showing success message
      setTimeout(() => {
        navigateTo('/profile');
      }, 2000);
    } else {
      errorMessage.value = response.message || 'Failed to accept invite. Please try again.';
      console.error('Failed to accept invite:', response.message);
    }
    
  } catch (error) {
    console.error('Error accepting invite:', error);
    errorMessage.value = error.message || 'An error occurred while accepting the invite. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
};


</script>

<style scoped>
/* Custom styles for casting director invite page */
.bg-purple-500\/10 {
  background-color: rgba(168, 85, 247, 0.1);
}

.border-purple-500\/30 {
  border-color: rgba(168, 85, 247, 0.3);
}

.text-purple-400 {
  color: #c084fc;
}

.text-purple-300 {
  color: #d8b4fe;
}

.bg-purple-500 {
  background-color: #a855f7;
}

.hover\:bg-purple-600:hover {
  background-color: #9333ea;
}

.bg-yellow-500\/10 {
  background-color: rgba(234, 179, 8, 0.1);
}

.border-yellow-500\/30 {
  border-color: rgba(234, 179, 8, 0.3);
}

.text-yellow-300 {
  color: #fde047;
}

.bg-yellow-500\/20 {
  background-color: rgba(234, 179, 8, 0.2);
}
</style>
