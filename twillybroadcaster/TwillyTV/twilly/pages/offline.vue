<template>
  <div class="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
    <div class="max-w-md w-full text-center">
      <!-- Offline Icon -->
      <div class="mb-8">
        <div class="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="heroicons:wifi" class="w-12 h-12 text-red-400" />
        </div>
        <h1 class="text-2xl font-bold text-white mb-2">You're Offline</h1>
        <p class="text-gray-400">Don't worry! You can still access your cached content.</p>
      </div>

      <!-- Offline Features -->
      <div class="space-y-4 mb-8">
        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-4">
          <div class="flex items-center gap-3">
            <Icon name="heroicons:play" class="w-6 h-6 text-teal-400" />
            <div class="text-left">
              <h3 class="text-white font-semibold">Cached Content</h3>
              <p class="text-gray-400 text-sm">Watch previously loaded videos and episodes</p>
            </div>
          </div>
        </div>

        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-4">
          <div class="flex items-center gap-3">
            <Icon name="heroicons:bookmark" class="w-6 h-6 text-purple-400" />
            <div class="text-left">
              <h3 class="text-white font-semibold">Saved Content</h3>
              <p class="text-gray-400 text-sm">Access your bookmarked and favorite content</p>
            </div>
          </div>
        </div>

        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-blue-500/30 p-4">
          <div class="flex items-center gap-3">
            <Icon name="heroicons:user" class="w-6 h-6 text-blue-400" />
            <div class="text-left">
              <h3 class="text-white font-semibold">Profile Access</h3>
              <p class="text-gray-400 text-sm">View your profile and settings</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="space-y-3">
        <button 
          @click="goHome"
          class="w-full px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 transition-all duration-300 transform hover:scale-105 active:scale-95"
        >
          <Icon name="heroicons:home" class="w-5 h-5 inline mr-2" />
          Go to Home
        </button>
        
        <button 
          @click="retryConnection"
          class="w-full px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-all duration-300 transform hover:scale-105 active:scale-95"
        >
          <Icon name="heroicons:arrow-path" class="w-5 h-5 inline mr-2" />
          Retry Connection
        </button>
      </div>

      <!-- Connection Status -->
      <div class="mt-8 p-4 bg-black/20 rounded-lg border border-gray-700">
        <div class="flex items-center justify-center gap-2 mb-2">
          <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span class="text-gray-400 text-sm">Offline Mode</span>
        </div>
        <p class="text-gray-500 text-xs">
          We'll automatically reconnect when your internet is back
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const isOnline = ref(navigator.onLine)

// Check connection status
const checkConnection = () => {
  isOnline.value = navigator.onLine
  if (isOnline.value) {
    // Redirect to home when back online
    navigateTo('/')
  }
}

// Go to home page
const goHome = () => {
  navigateTo('/')
}

// Retry connection
const retryConnection = () => {
  window.location.reload()
}

onMounted(() => {
  // Listen for online/offline events
  window.addEventListener('online', checkConnection)
  window.addEventListener('offline', checkConnection)
  
  // Check if we're back online
  if (navigator.onLine) {
    navigateTo('/')
  }
})

// Cleanup
onUnmounted(() => {
  window.removeEventListener('online', checkConnection)
  window.removeEventListener('offline', checkConnection)
})
</script>

<style scoped>
/* Custom animations for offline state */
@keyframes pulse-red {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
