<template>
  <div class="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <!-- Success Card -->
      <div class="bg-gradient-to-br from-teal-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl p-8 border border-teal-500/30 shadow-2xl">
        <!-- Success Icon -->
        <div class="flex justify-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
            <Icon name="heroicons:check" class="w-8 h-8 text-white" />
          </div>
        </div>

        <!-- Success Message -->
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-white mb-2">Subscription Successful!</h1>
          <p class="text-gray-300">Your subscription has been activated successfully.</p>
        </div>

        <!-- Subscription Details -->
        <div class="bg-black/30 rounded-xl p-6 mb-6 border border-teal-500/20">
          <h3 class="text-lg font-semibold text-white mb-4">Subscription Details</h3>
          <div class="space-y-3 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Status:</span>
              <span class="text-teal-400 font-medium">Active</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Amount:</span>
              <span class="text-white">$9.99/month</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Next Billing:</span>
              <span class="text-white">{{ nextBillingDate }}</span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="space-y-4">
          <button 
            @click="goToDashboard"
            class="w-full bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold py-3 px-6 rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-300 transform hover:scale-105 shadow-lg block text-center"
          >
            Go to Dashboard
          </button>
          
          <button 
            @click="viewSubscription"
            class="w-full bg-transparent border border-teal-500/50 text-teal-400 font-semibold py-3 px-6 rounded-xl hover:bg-teal-500/10 transition-all duration-300"
          >
            View Subscription Details
          </button>
        </div>

        <!-- Help Text -->
        <div class="mt-6 text-center">
          <p class="text-gray-400 text-sm">
            You'll receive a confirmation email shortly. 
            If you have any questions, please contact support.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const route = useRoute();
const sessionId = route.query.session_id;

// Calculate next billing date (30 days from now)
const nextBillingDate = computed(() => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
});

const viewSubscription = () => {
  // TODO: Implement subscription details view
  console.log('View subscription details for session:', sessionId);
};

const goToDashboard = () => {
  // Navigate to account page with subscriptions tab for all users
  navigateTo('/account?section=subscriptions');
};
</script> 