<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-white mb-4">Invitation Accepted!</h1>
      <p class="text-gray-300 mb-8">You have successfully accepted the invitation.</p>
      <button 
        @click="navigateTo('/profile')"
        class="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
});
</script> 