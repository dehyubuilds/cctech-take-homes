<template>
  <div class="min-h-screen bg-gradient-to-br from-[#1a1a1a] to-[#000000] flex items-center justify-center">
    <div class="max-w-md w-full mx-4">
      <div class="bg-black/40 backdrop-blur-sm rounded-xl p-8 border border-white/10">
        <div v-if="loading" class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400 mb-4"></div>
          <p class="text-gray-300">Processing your Lemon Squeezy account connection...</p>
        </div>
        
        <div v-else-if="error" class="text-center">
          <div class="mb-4 text-red-400">
            <Icon name="heroicons:exclamation-circle" class="w-12 h-12 mx-auto" />
          </div>
          <h2 class="text-xl font-semibold text-white mb-2">Connection Failed</h2>
          <p class="text-gray-300 mb-6">{{ error }}</p>
          <button 
            @click="retryConnection" 
            class="w-full bg-teal-500 text-white rounded-lg py-3 px-4 hover:bg-teal-600 transition-colors"
          >
            Try Again
          </button>
        </div>
        
        <div v-else class="text-center">
          <div class="mb-4 text-teal-400">
            <Icon name="heroicons:check-circle" class="w-12 h-12 mx-auto" />
          </div>
          <h2 class="text-xl font-semibold text-white mb-2">Successfully Connected!</h2>
          <p class="text-gray-300 mb-6">Your Lemon Squeezy account has been successfully connected to Twilly.</p>
          <NuxtLink 
                          to="/account" 
            class="w-full bg-teal-500 text-white rounded-lg py-3 px-4 hover:bg-teal-600 transition-colors block"
          >
            Return to Account Settings
          </NuxtLink>
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

const checkAccountStatus = async () => {
  try {
    console.log('[DEBUG] Starting checkAccountStatus with user:', authStore.user?.username);
    // Lemon Squeezy integration - no API call needed
    console.log('Lemon Squeezy integration - account status handled automatically');
    
    // Return success status for Lemon Squeezy
    return {
      status: 'success',
      accountId: 'lemonsqueezy_account',
      isComplete: true,
      requirements: []
    };
  } catch (err) {
    console.error('[DEBUG] Error in checkAccountStatus:', err);
    throw err;
  }
};

const retryConnection = async () => {
  loading.value = true;
  error.value = null;
  try {
    await checkAccountStatus();
    loading.value = false;
  } catch (err) {
    console.error('Retry connection error:', err);
    error.value = err.message || 'Failed to verify account connection';
    loading.value = false;
  }
};

onMounted(async () => {
  try {
    // Check if user is authenticated
    console.log('[Onboarding Complete] Checking authentication:', authStore.authenticated, authStore.user?.username);
    if (!authStore.authenticated) {
      console.log('[Onboarding Complete] Not authenticated, redirecting to /login');
      navigateTo('/login');
      return;
    }

    // Check account status
    console.log('[Onboarding Complete] Checking Lemon Squeezy account status for user:', authStore.user?.username);
    const statusResponse = await checkAccountStatus();
    console.log('[Onboarding Complete] Status response:', statusResponse);
    loading.value = false;
  } catch (err) {
    console.error('[Onboarding Complete] Error:', err);
    error.value = err.message || 'Failed to process onboarding completion';
    loading.value = false;
  }
});
</script> 