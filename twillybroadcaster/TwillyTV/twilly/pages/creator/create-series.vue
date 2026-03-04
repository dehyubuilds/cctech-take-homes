<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] pt-16">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-4">
          <button
            @click="goBack"
            class="text-gray-400 hover:text-white transition-colors"
          >
            <Icon name="heroicons:arrow-left" class="w-6 h-6" />
          </button>
          <h1 class="text-3xl font-bold text-white">Create Subscription Series</h1>
        </div>
        <p class="text-gray-300 text-lg">
          Set up a subscription-based series where viewers pay monthly to access your content.
        </p>
      </div>

      <!-- Series Creator Component -->
      <SeriesCreator
        @cancel="goBack"
        @series-created="handleSeriesCreated"
      />

      <!-- Info Cards -->
      <div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-black/20 backdrop-blur-sm rounded-xl border border-teal-500/20 p-6">
          <div class="flex items-center gap-3 mb-4">
            <Icon name="heroicons:currency-dollar" class="w-8 h-8 text-teal-400" />
            <h3 class="text-lg font-semibold text-white">Revenue Model</h3>
          </div>
          <p class="text-gray-300 text-sm">
            You keep 70% of each subscription. Platform fee is 30%. Add collaborators to share your revenue.
          </p>
        </div>

        <div class="bg-black/20 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6">
          <div class="flex items-center gap-3 mb-4">
            <Icon name="heroicons:users" class="w-8 h-8 text-purple-400" />
            <h3 class="text-lg font-semibold text-white">Collaborative</h3>
          </div>
          <p class="text-gray-300 text-sm">
            Invite other creators to stream to your series. Set custom revenue shares for each collaborator.
          </p>
        </div>

        <div class="bg-black/20 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6">
          <div class="flex items-center gap-3 mb-4">
            <Icon name="heroicons:chart-bar" class="w-8 h-8 text-blue-400" />
            <h3 class="text-lg font-semibold text-white">Analytics</h3>
          </div>
          <p class="text-gray-300 text-sm">
            Track subscriber growth, revenue, and content performance. Get detailed insights into your audience.
          </p>
        </div>
      </div>

      <!-- How It Works -->
      <div class="mt-12 bg-black/20 backdrop-blur-sm rounded-xl border border-white/10 p-8">
        <h2 class="text-2xl font-bold text-white mb-6">How Subscription Series Work</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="text-center">
            <div class="w-12 h-12 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="text-teal-400 font-bold text-lg">1</span>
            </div>
            <h3 class="text-white font-semibold mb-2">Create Series</h3>
            <p class="text-gray-300 text-sm">Set up your series with monthly pricing and revenue sharing</p>
          </div>

          <div class="text-center">
            <div class="w-12 h-12 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="text-teal-400 font-bold text-lg">2</span>
            </div>
            <h3 class="text-white font-semibold mb-2">Go Live</h3>
            <p class="text-gray-300 text-sm">Stream content that automatically becomes episodes</p>
          </div>

          <div class="text-center">
            <div class="w-12 h-12 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="text-teal-400 font-bold text-lg">3</span>
            </div>
            <h3 class="text-white font-semibold mb-2">Subscribers Pay</h3>
            <p class="text-gray-300 text-sm">Viewers subscribe monthly to access your content</p>
          </div>

          <div class="text-center">
            <div class="w-12 h-12 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="text-teal-400 font-bold text-lg">4</span>
            </div>
            <h3 class="text-white font-semibold mb-2">Get Paid</h3>
            <p class="text-gray-300 text-sm">Receive 70% of each subscription automatically</p>
          </div>
        </div>
      </div>

      <!-- Success Modal -->
      <div v-if="showSuccessModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div class="bg-black/90 border border-teal-500/30 rounded-xl p-8 max-w-lg w-full mx-4">
          <div class="text-center">
            <Icon name="heroicons:check-circle" class="w-20 h-20 text-teal-400 mx-auto mb-6" />
            <h3 class="text-2xl font-bold text-white mb-4">Series Created Successfully!</h3>
            <p class="text-gray-300 mb-6">
              Your subscription series is now live and ready to accept subscribers. Start streaming to build your audience!
            </p>
            
            <div class="space-y-4 mb-8">
              <div class="bg-teal-500/10 border border-teal-500/20 rounded-lg p-4">
                <p class="text-teal-300 font-medium">Next Steps:</p>
                <ul class="text-gray-300 text-sm mt-2 space-y-1">
                  <li>• Start streaming to create episodes</li>
                  <li>• Share your series link with potential subscribers</li>
                  <li>• Monitor your subscriber growth and revenue</li>
                </ul>
              </div>
            </div>
            
            <div class="flex gap-4">
              <button
                @click="viewSeries"
                class="flex-1 bg-teal-500 hover:bg-teal-600 text-white py-3 px-6 rounded-lg font-medium transition-colors"
              >
                View Series
              </button>
              <button
                @click="goToDashboard"
                class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const showSuccessModal = ref(false);
const createdSeriesData = ref(null);

// Check authentication
onMounted(() => {
  if (!authStore.authenticated) {
    navigateTo('/signin');
  }
});

// Go back
const goBack = () => {
  navigateTo('/creator/dashboard');
};

// Handle series created
const handleSeriesCreated = (data) => {
  createdSeriesData.value = data;
  showSuccessModal.value = true;
};

// View series
const viewSeries = () => {
  if (createdSeriesData.value?.seriesId) {
    navigateTo(`/series/${createdSeriesData.value.seriesId}`);
  }
};

// Go to dashboard
const goToDashboard = () => {
  navigateTo('/creator/dashboard');
};
</script>

<style scoped>
/* Custom animations */
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
</style> 