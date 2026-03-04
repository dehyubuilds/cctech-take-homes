<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-12 px-4">
    <div class="max-w-2xl mx-auto text-center">
      <!-- Success Icon -->
      <div class="mb-8">
        <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="heroicons:check-circle" class="w-12 h-12 text-green-400" />
        </div>
        <h1 class="text-3xl font-bold text-white mb-2">Purchase Successful!</h1>
        <p class="text-gray-300 text-lg">Thank you for your purchase</p>
      </div>

      <!-- Purchase Details -->
      <div v-if="purchaseDetails" class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 mb-8">
        <h2 class="text-xl font-semibold text-white mb-4">Purchase Details</h2>
        <div class="space-y-3 text-left">
          <div class="flex justify-between">
            <span class="text-gray-300">Item:</span>
            <span class="text-white font-medium">{{ purchaseDetails.title }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-300">Amount:</span>
            <span class="text-white font-medium">${{ purchaseDetails.amount }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-300">Creator:</span>
            <span class="text-white font-medium">{{ purchaseDetails.creatorName }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-300">Date:</span>
            <span class="text-white font-medium">{{ formatDate(purchaseDetails.purchaseDate) }}</span>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="space-y-4">
        <button
          @click="viewContent"
          class="w-full bg-teal-500 text-white px-6 py-3 rounded-lg hover:bg-teal-600 transition-colors duration-300 flex items-center justify-center gap-2"
        >
          <Icon name="heroicons:play" class="w-5 h-5" />
          View Your Content
        </button>
        
        <button
          @click="goToProfile"
          class="w-full bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors duration-300 flex items-center justify-center gap-2"
        >
          <Icon name="heroicons:user" class="w-5 h-5" />
          Go to My Profile
        </button>
      </div>

      <!-- Additional Info -->
      <div class="mt-8 text-sm text-gray-400">
        <p>You can access your purchased content anytime from your profile page.</p>
        <p class="mt-2">A receipt has been sent to your email address.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const purchaseDetails = ref(null);

onMounted(() => {
  // Get purchase details from URL parameters or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order_id');
  
  if (orderId) {
    // In a real implementation, you'd fetch purchase details from your API
    purchaseDetails.value = {
      title: 'Your Purchased Content',
      amount: '9.99',
      creatorName: 'Content Creator',
      purchaseDate: new Date().toISOString()
    };
  }
});

const formatDate = (date) => {
  return new Date(date).toLocaleDateString();
};

const viewContent = () => {
  // Navigate to the content viewer or profile purchases
  navigateTo('/profile');
};

const goToProfile = () => {
  navigateTo('/profile');
};
</script> 