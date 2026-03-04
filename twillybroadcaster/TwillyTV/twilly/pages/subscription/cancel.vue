<template>
  <div class="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <!-- Cancel Card -->
      <div class="bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-xl rounded-2xl p-8 border border-red-500/30 shadow-2xl">
        <!-- Cancel Icon -->
        <div class="flex justify-center mb-6">
          <div class="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
            <Icon name="heroicons:x-mark" class="w-8 h-8 text-white" />
          </div>
        </div>

        <!-- Cancel Message -->
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-white mb-2">Subscription Cancelled</h1>
          <p class="text-gray-300">Your subscription was not completed. No charges were made.</p>
        </div>

        <!-- Information -->
        <div class="bg-black/30 rounded-xl p-6 mb-6 border border-red-500/20">
          <h3 class="text-lg font-semibold text-white mb-4">What Happened?</h3>
          <div class="space-y-3 text-sm text-gray-300">
            <p>• No payment was processed</p>
            <p>• Your account was not charged</p>
            <p>• You can try subscribing again anytime</p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="space-y-4">
          <button 
            @click="tryAgain"
            class="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold py-3 px-6 rounded-xl hover:from-red-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            Try Again
          </button>
          
          <NuxtLink 
            to="/" 
            class="w-full bg-transparent border border-red-500/50 text-red-400 font-semibold py-3 px-6 rounded-xl hover:bg-red-500/10 transition-all duration-300 block text-center"
          >
            Go to Dashboard
          </NuxtLink>
        </div>

        <!-- Help Text -->
        <div class="mt-6 text-center">
          <p class="text-gray-400 text-sm">
            Having trouble? Contact our support team for assistance.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const router = useRouter();

const tryAgain = () => {
  // Go back to the previous page or subscription page
  router.go(-1);
};
</script> 