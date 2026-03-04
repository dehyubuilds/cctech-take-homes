<template>
  <div class="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#000000] flex items-center justify-center">
    <div class="max-w-md w-full mx-4">
      <div class="bg-black/40 backdrop-blur-sm rounded-xl p-8 border border-white/10">
        <div v-if="loading" class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400 mb-4"></div>
          <p class="text-gray-300">Refreshing your Lemon Squeezy onboarding session...</p>
        </div>
        
        <div v-else-if="error" class="text-center">
          <div class="mb-4 text-red-400">
            <Icon name="heroicons:exclamation-circle" class="w-12 h-12 mx-auto" />
          </div>
          <h2 class="text-xl font-semibold text-white mb-2">Refresh Failed</h2>
          <p class="text-gray-300 mb-6">{{ error }}</p>
          <button 
            @click="retryRefresh" 
            class="w-full bg-teal-500 text-white rounded-lg py-3 px-4 hover:bg-teal-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';


const authStore = useAuthStore();

const loading = ref(true);
const error = ref(null);

const refreshOnboarding = async () => {
  try {
    console.log('[DEBUG] Starting onboarding refresh for user:', authStore.user?.username);
    
    // Lemon Squeezy integration - redirect to signup
    console.log('Lemon Squeezy integration - redirecting to signup');
    
    // Redirect to Lemon Squeezy signup
    window.location.href = 'https://app.lemonsqueezy.com/signup';
  } catch (err) {
    console.error('[DEBUG] Error refreshing onboarding:', err);
    error.value = err.message || 'Failed to refresh onboarding session';
    loading.value = false;
  }
};

const retryRefresh = () => {
  loading.value = true;
  error.value = null;
  refreshOnboarding();
};

onMounted(async () => {
  try {
    // Check if user is authenticated
    if (!authStore.authenticated) {
      console.log('[DEBUG] Not authenticated, redirecting to /login');
      navigateTo('/login');
      return;
    }

    await refreshOnboarding();
  } catch (err) {
    console.error('[DEBUG] Error in onMounted:', err);
    error.value = err.message || 'Failed to refresh onboarding session';
    loading.value = false;
  }
});
</script> 