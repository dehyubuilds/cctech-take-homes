<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <!-- Simple Header -->
    <div class="bg-black/80 border-b border-teal-500/30">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <NuxtLink to="/home" class="flex items-center gap-2 text-white hover:text-teal-400 transition-colors">
            <Icon name="heroicons:arrow-left" class="w-5 h-5" />
            <span class="text-sm font-medium">Back</span>
          </NuxtLink>
          <div class="w-16"></div>
          <div class="w-16"></div>
        </div>
      </div>
    </div>

    <div class="max-w-lg mx-auto px-4 py-6">
      <!-- Simple Hero -->
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-white mb-3">
          Twilly <span class="text-teal-400">Premium</span>
        </h2>
        <p class="text-gray-300 text-sm leading-relaxed">
          Access all 5 channels. One simple price.
        </p>
      </div>

      <!-- Simple Plan Card -->
      <div class="bg-black/40 rounded-xl border border-teal-500/30 p-6 mb-6">
        <div class="text-center mb-6">
          <div class="text-3xl font-bold text-white mb-2">
            $9.99<span class="text-lg text-gray-300">/month</span>
          </div>
          <p class="text-gray-300 text-sm">Cancel anytime</p>
        </div>
        
        <div class="space-y-3 mb-6">
          <div class="flex items-center gap-3 text-gray-300 text-sm">
            <Icon name="heroicons:check" class="w-4 h-4 text-green-400 flex-shrink-0" />
            <span>All 5 premium channels</span>
          </div>
          <div class="flex items-center gap-3 text-gray-300 text-sm">
            <Icon name="heroicons:check" class="w-4 h-4 text-green-400 flex-shrink-0" />
            <span>HD streaming quality</span>
          </div>
          <div class="flex items-center gap-3 text-gray-300 text-sm">
            <Icon name="heroicons:check" class="w-4 h-4 text-green-400 flex-shrink-0" />
            <span>Watch on any device</span>
          </div>
          <div class="flex items-center gap-3 text-gray-300 text-sm">
            <Icon name="heroicons:check" class="w-4 h-4 text-green-400 flex-shrink-0" />
            <span>No ads</span>
          </div>
        </div>
        
        <button 
          @click="selectPlan('network', 9.99)"
          class="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 rounded-lg transition-colors text-base"
        >
          Start Free Trial
        </button>
      </div>

      <!-- Simple Channels List -->
      <div class="mb-6">
        <h3 class="text-lg font-semibold text-white mb-4">Included Channels</h3>
        <div class="space-y-2">
          <div class="flex items-center gap-3 text-gray-300 text-sm">
            <Icon name="heroicons:moon" class="w-4 h-4 text-teal-400" />
            <span>Twilly After Dark</span>
          </div>
          <div class="flex items-center gap-3 text-gray-300 text-sm">
            <Icon name="heroicons:heart" class="w-4 h-4 text-green-400" />
            <span>Twilly Fit</span>
          </div>
          <div class="flex items-center gap-3 text-gray-300 text-sm">
            <Icon name="heroicons:play" class="w-4 h-4 text-blue-400" />
            <span>Twilly Game Zone</span>
          </div>
          <div class="flex items-center gap-3 text-gray-300 text-sm">
            <Icon name="heroicons:musical-note" class="w-4 h-4 text-purple-400" />
            <span>Twilly Music Stream</span>
          </div>
          <div class="flex items-center gap-3 text-gray-300 text-sm">
            <Icon name="heroicons:cpu-chip" class="w-4 h-4 text-orange-400" />
            <span>Twilly Tech Stream</span>
          </div>
        </div>
      </div>

      <!-- Simple Info -->
      <div class="text-center mb-6">
        <p class="text-gray-400 text-sm mb-4">
          7-day free trial • Cancel anytime • No contracts
        </p>
        <button 
          @click="navigateTo('/home')"
          class="text-teal-400 text-sm underline"
        >
          Browse content first
        </button>
      </div>
    </div>

    <!-- Simple Modal -->
    <div v-if="showSubscriptionModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div class="bg-gray-900 rounded-xl p-6 max-w-sm w-full">
        <h2 class="text-lg font-bold text-white mb-4">Start Free Trial</h2>
        
        <div class="mb-6">
          <p class="text-gray-300 text-sm mb-2">Twilly Premium</p>
          <p class="text-white text-lg font-semibold">${{ selectedPlan.price }}/month after trial</p>
          <p class="text-gray-400 text-xs">7-day free trial • Cancel anytime</p>
        </div>

        <div class="flex flex-col gap-3">
          <button
            @click="proceedToPayment"
            class="w-full bg-teal-600 text-white py-3 rounded-lg font-medium"
          >
            Continue
          </button>
          <button
            @click="showSubscriptionModal = false"
            class="w-full text-gray-400 py-2 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

// Meta tags
useHead({
  title: 'Choose Your Twilly Plan - Premium Streaming Network',
  meta: [
    {
      name: 'description',
      content: 'Choose your Twilly subscription plan and get unlimited access to all 5 premium channels. Start streaming today with our Netflix-style plans.'
    }
  ]
});

// State
const showSubscriptionModal = ref(false);
const selectedPlan = ref({
  name: '',
  price: 0,
  features: []
});

// Simple plan data
const plans = {
  network: {
    name: 'Twilly Premium',
    price: 9.99
  }
};

// Methods
const selectPlan = (planType, price) => {
  selectedPlan.value = plans[planType];
  showSubscriptionModal.value = true;
};

const proceedToPayment = () => {
  const subscriptionData = {
    plan: selectedPlan.value.name,
    price: selectedPlan.value.price
  };
  
  if (process.client) {
    localStorage.setItem('selectedSubscription', JSON.stringify(subscriptionData));
  }
  
  showSubscriptionModal.value = false;
  navigateTo('/signin?subscription=true');
};
</script>
