<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] flex items-center justify-center p-4">
    <div class="w-full max-w-2xl">
      <!-- Loading State -->
      <div v-if="loading" class="text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto mb-4"></div>
        <p class="text-gray-400">Loading casting director information...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-500/20 border border-red-500/30 rounded-xl p-6 text-center">
        <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 class="text-xl font-semibold text-red-300 mb-2">Invalid Referral Link</h2>
        <p class="text-red-200">{{ error }}</p>
      </div>

      <!-- Casting Director Info -->
      <div v-else-if="referralData" class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:user-group" class="w-8 h-8 text-white" />
          </div>
          <h1 class="text-3xl font-bold text-white mb-2">You were referred by a Casting Director!</h1>
          <p class="text-gray-400">Join Twilly and discover amazing talent opportunities</p>
        </div>

        <!-- Casting Director Details -->
        <div class="bg-black/20 rounded-xl p-6 mb-6 border border-white/5">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Icon name="heroicons:user" class="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-white">Casting Director</h3>
              <p class="text-gray-400">{{ referralData.castingDirectorEmail }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2 text-sm text-gray-300">
            <Icon name="heroicons:building-office" class="w-4 h-4" />
            <span>{{ referralData.channelName }}</span>
          </div>
        </div>

        <!-- Channel Information -->
        <div class="bg-black/20 rounded-xl p-6 mb-6 border border-white/5">
          <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="heroicons:tv" class="w-5 h-5 text-teal-400" />
            Channel Information
          </h3>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <Icon name="heroicons:building-office" class="w-5 h-5 text-gray-400" />
              <span class="text-gray-300">{{ referralData.channelName }}</span>
            </div>
            <div class="flex items-center gap-3">
              <Icon name="heroicons:calendar" class="w-5 h-5 text-gray-400" />
              <span class="text-gray-300">Referred on {{ formatDate(referralData.referredAt) }}</span>
            </div>
          </div>
        </div>

        <!-- Call to Action -->
        <div class="text-center">
          <h3 class="text-xl font-semibold text-white mb-4">Ready to join Twilly?</h3>
          <p class="text-gray-400 mb-6">Sign up to access talent opportunities and start your journey</p>
          
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <NuxtLink 
              to="/signin" 
              class="bg-teal-500/20 text-teal-300 border border-teal-500/30 px-8 py-3 rounded-lg hover:bg-teal-500/30 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Icon name="heroicons:arrow-right-on-rectangle" class="w-5 h-5" />
              Sign In
            </NuxtLink>
            <NuxtLink 
              to="/signup" 
              class="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-8 py-3 rounded-lg hover:bg-purple-500/30 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Icon name="heroicons:user-plus" class="w-5 h-5" />
              Sign Up
            </NuxtLink>
          </div>
        </div>

        <!-- Benefits -->
        <div class="mt-8 pt-6 border-t border-white/10">
          <h4 class="text-lg font-semibold text-white mb-4 text-center">Why join Twilly?</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex items-center gap-3 text-sm text-gray-300">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
              <span>Access to exclusive talent opportunities</span>
            </div>
            <div class="flex items-center gap-3 text-sm text-gray-300">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
              <span>Connect with industry professionals</span>
            </div>
            <div class="flex items-center gap-3 text-sm text-gray-300">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
              <span>Build your portfolio and network</span>
            </div>
            <div class="flex items-center gap-3 text-sm text-gray-300">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
              <span>Earn from your talent and skills</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const loading = ref(true);
const error = ref(null);
const referralData = ref(null);

// Get referral code from route params
const referralCode = route.params.referralCode;

onMounted(async () => {
  try {
    // Track the referral (even if user doesn't sign up yet)
    const trackResponse = await $fetch('/api/casting-directors/track-referral', {
      method: 'POST',
      body: {
        referralCode: referralCode,
        talentEmail: 'anonymous', // Will be updated when user actually signs up
        channelId: null // Will be populated from referral mapping
      }
    });

    if (trackResponse.success) {
      referralData.value = trackResponse.referralData;
    } else {
      error.value = trackResponse.message || 'Invalid referral link';
    }
  } catch (err) {
    console.error('Error loading referral data:', err);
    error.value = 'Failed to load referral information';
  } finally {
    loading.value = false;
  }
});

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};
</script>

<style scoped>
/* Smooth transitions */
* {
  transition: all 0.2s ease;
}

/* Loading spinner animation */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Button hover effects */
button:hover, a:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Glass morphism effect */
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}
</style>
