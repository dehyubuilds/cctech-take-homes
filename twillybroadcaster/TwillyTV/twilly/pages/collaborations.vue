<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <!-- Fixed Header -->
    <div class="sticky top-0 z-10 bg-gradient-to-br from-[#084d5d] to-black py-6 sm:py-8 px-4">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-3xl sm:text-4xl font-bold text-white mb-2 text-center sm:text-left">
          My <span class="text-teal-400">Collaborations</span>
        </h1>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-7xl mx-auto px-4 py-6">
      <!-- Category Sections -->
      <div class="space-y-12">
        <!-- Mixed Series Section -->
        <section v-if="seriesByCategory['Mixed']?.length > 0">
          <div class="flex items-center gap-3 mb-6">
            <Icon name="heroicons:folder" class="w-6 h-6 text-teal-400" />
            <h2 class="text-xl sm:text-2xl font-bold text-white">Mixed Series</h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div v-for="series in seriesByCategory['Mixed']" :key="series.SK" 
                 class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-900/30 p-4 sm:p-6">
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h3 class="text-lg sm:text-xl font-bold text-teal-400">{{ series.name }}</h3>
                  <p class="text-gray-400 text-sm">Created: {{ new Date(series.createdAt).toLocaleDateString() }}</p>
                </div>
              </div>
              <button 
                @click="generateShareLink(series)"
                class="w-full px-4 py-2 bg-teal-500/20 text-teal-300 rounded-lg text-sm
                       hover:bg-teal-500/30 transition-all duration-300"
              >
                Generate Collaboration Link
              </button>
              <!-- Share Link Display -->
              <div v-if="selectedSeries?.SK === series.SK && shareableLink" 
                   class="mt-4 p-3 bg-black/20 rounded-lg">
                <div class="flex items-center justify-between gap-2 mb-2">
                  <span class="text-white text-sm">Share Link:</span>
                  <button 
                    @click="copyLink"
                    class="text-teal-400 hover:text-teal-300 text-sm"
                  >
                    {{ linkCopied ? 'Copied!' : 'Copy' }}
                  </button>
                </div>
                <p class="text-gray-300 text-sm break-all">
                  {{ shareableLink }}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Empty State -->
      <div v-if="!hasSeries" class="text-center py-12">
        <Icon name="heroicons:folder-plus" class="w-12 h-12 text-teal-400/50 mx-auto mb-4" />
        <h3 class="text-xl font-semibold text-white mb-2">No Series Found</h3>
        <p class="text-gray-400">Create series in the Manage Uploads section to start collaborating</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { Auth } from 'aws-amplify';
import { useFileStore } from '~/stores/useFileStore';
import { useTaskStore } from '~/stores/TaskStore';
import { useAuthStore } from '~/stores/auth';

const fileStore = useFileStore();
const taskStore = useTaskStore();
const authStore = useAuthStore();
const mySeries = ref([]);
const shareableLink = ref('');
const linkCopied = ref(false);
const selectedSeries = ref(null);
const isLoading = ref(true);
const error = ref(null);

// Initialize auth state on mount
onMounted(async () => {
  try {
    // First check if we already have auth state
    if (authStore.authenticated && authStore.user) {
      console.log('Using existing auth state:', {
        isAuthenticated: authStore.authenticated,
        user: authStore.user
      });
      await fetchMySeries();
      isLoading.value = false;
      return;
    }

    // If no auth state, try to get from AWS
    const user = await Auth.currentAuthenticatedUser();
    if (user) {
      console.log('Cognito User:', user);
      // Check if user has email in attributes or username
      const isProducer = user?.attributes?.email || user?.username?.includes('@');
      if (isProducer) {
        authStore.authenticated = true;
        authStore.user = user;
        authStore.userType = 'producer';
        console.log('User is a producer');
        await fetchMySeries();
      } else {
        authStore.authenticated = true;
        authStore.user = user;
        authStore.userType = 'regular';
        console.log('User is a regular user');
        navigateTo('/profile');
      }
    } else {
      // If no AWS user, try to initialize from localStorage
      await authStore.initializeAuth();
      if (authStore.authenticated && authStore.user) {
        await fetchMySeries();
      }
    }
  } catch (error) {
    console.log('No authenticated user found');
    // Try to initialize from localStorage
    await authStore.initializeAuth();
    if (authStore.authenticated && authStore.user) {
      await fetchMySeries();
    }
  } finally {
    isLoading.value = false;
  }
});

// Watch for auth state changes
watch(() => authStore.authenticated, (newVal) => {
  if (!newVal && !isLoading.value) {
    // Only redirect if we're sure the user is not authenticated
    navigateTo('/home');
  }
}, { immediate: true });

// Fetch all series (folders) for the current user
const fetchMySeries = async () => {
  try {
    if (!authStore.authenticated || !authStore.user) {
      console.log('User not authenticated, redirecting...');
      navigateTo('/');
      return;
    }

    const isProducer = authStore.user?.attributes?.email || authStore.user?.username?.includes('@');
    if (!isProducer) {
      console.log('User is not a producer, redirecting...');
      navigateTo('/profile');
      return;
    }

    await fileStore.getFiles(authStore.user.attributes.email);
    
    // Get all Mixed category folders
    const mixedFolders = fileStore.categoryFolders('Mixed')
      .filter(folder => folder.name !== 'default' && folder.name !== 'thumbnails');
    
    mySeries.value = mixedFolders;
    console.log('mySeries value:', mySeries.value);
  } catch (error) {
    console.error('Error fetching series:', error);
    if (error.message === 'The user is not authenticated') {
      navigateTo('/');
    }
  }
};

// Generate shareable link for a series
const generateShareLink = async (series) => {
  try {
    if (!authStore.authenticated || !authStore.user) {
      console.log('User not authenticated, redirecting...');
      navigateTo('/');
      return;
    }

    const userId = authStore.user?.attributes?.sub;
    if (!userId) {
      throw new Error('User ID not found');
    }

    selectedSeries.value = series;
    
    const baseUrl = window.location.origin;
    
    // Get the seriesPosterUrl and ensure it's properly formatted
    let posterUrl = series.seriesPosterUrl || 'default';
    
    // If it's not 'default', ensure it has the public/ prefix
    if (posterUrl !== 'default') {
      // Remove any existing CloudFront domain if present
      posterUrl = posterUrl.replace('https://d3hv50jkrzkiyh.cloudfront.net/', '');
      
      // Ensure it has the public/ prefix
      if (!posterUrl.startsWith('public/')) {
        posterUrl = `public/${posterUrl}`;
      }
    }
    
    // Construct the full URL with all necessary parameters
    const fullUrl = `${baseUrl}/channel/collab/${encodeURIComponent(userId)}/${encodeURIComponent(series.name)}/${encodeURIComponent(series.category)}/${encodeURIComponent(posterUrl)}`;
    
    // Add title and description to the URL for better preview
    const previewUrl = `${fullUrl}?title=${encodeURIComponent(series.name)}&description=${encodeURIComponent(`Collaboration invitation for ${series.name}`)}`;
    
    const response = await taskStore.shortenUrl({ url: previewUrl });
    if (response && response.returnResult) {
      shareableLink.value = response.returnResult;
    }
  } catch (error) {
    console.error('Error generating share link:', error);
    alert('Failed to generate share link: ' + error.message);
  }
};

const copyLink = () => {
  navigator.clipboard.writeText(shareableLink.value);
  linkCopied.value = true;
  setTimeout(() => {
    linkCopied.value = false;
  }, 2000);
};

// Add computed property for organized series
const seriesByCategory = computed(() => {
  // Since all folders are Mixed, we'll just show them all in one section
  return {
    'Mixed': mySeries.value
  };
});

const hasSeries = computed(() => mySeries.value.length > 0);

// Add a watcher to see when mySeries changes
watch(mySeries, (newValue) => {
  console.log('mySeries changed:', newValue);
}, { deep: true });
</script>

<style scoped>
.collab-card {
  @apply bg-black/20 backdrop-blur-sm rounded-lg border border-teal-900/30 p-4;
}

.input-field {
  @apply w-full px-4 py-2 bg-black/20 border border-teal-900/30 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-teal-500;
}

.remove-btn {
  @apply px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all duration-300;
}
</style> 