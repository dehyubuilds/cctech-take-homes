<template>
  <div v-if="showInstallPrompt" class="pwa-install-banner">
    <div class="bg-gradient-to-r from-teal-500 to-cyan-500 text-white p-4 rounded-lg shadow-lg">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <Icon name="heroicons:device-phone-mobile" class="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 class="font-semibold text-sm">Install Twilly App</h3>
            <p class="text-xs text-teal-100">Get the full app experience with offline access</p>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <button
            @click="dismissInstall"
            class="text-white/80 hover:text-white transition-colors p-1"
          >
            <Icon name="heroicons:x-mark" class="w-5 h-5" />
          </button>
          
          <button
            @click="installApp"
            class="bg-white text-teal-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-teal-50 transition-colors transform hover:scale-105 active:scale-95"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const { $pwa } = useNuxtApp()

const showInstallPrompt = ref(false)

// Install the app
const installApp = async () => {
  try {
    await $pwa.promptInstall()
    showInstallPrompt.value = false
  } catch (error) {
    console.error('Install failed:', error)
  }
}

// Dismiss the install prompt
const dismissInstall = () => {
  showInstallPrompt.value = false
  // Store dismissal in localStorage to avoid showing again immediately
  localStorage.setItem('twilly-install-dismissed', Date.now().toString())
}

// Check if install prompt should be shown
const shouldShowInstallPrompt = () => {
  // Don't show if already installed
  if ($pwa.isInstalled()) {
    return false
  }
  
  // Don't show if install not available
  if (!$pwa.isInstallAvailable()) {
    return false
  }
  
  // Don't show if recently dismissed
  const dismissed = localStorage.getItem('twilly-install-dismissed')
  if (dismissed) {
    const dismissedTime = parseInt(dismissed)
    const now = Date.now()
    // Show again after 24 hours
    if (now - dismissedTime < 24 * 60 * 60 * 1000) {
      return false
    }
  }
  
  return true
}

// Handle install available event
const handleInstallAvailable = () => {
  if (shouldShowInstallPrompt()) {
    showInstallPrompt.value = true
  }
}

// Handle app installed event
const handleAppInstalled = () => {
  showInstallPrompt.value = false
}

onMounted(() => {
  // Check if we should show install prompt
  if (shouldShowInstallPrompt()) {
    showInstallPrompt.value = true
  }
  
  // Listen for events
  window.addEventListener('twilly-install-available', handleInstallAvailable)
  window.addEventListener('twilly-installed', handleAppInstalled)
})

onUnmounted(() => {
  // Clean up event listeners
  window.removeEventListener('twilly-install-available', handleInstallAvailable)
  window.removeEventListener('twilly-installed', handleAppInstalled)
})
</script>

<style scoped>
.pwa-install-banner {
  position: fixed;
  bottom: 4rem;
  left: 1rem;
  right: 1rem;
  z-index: 50;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Mobile optimizations */
@media (max-width: 640px) {
  .pwa-install-banner {
    bottom: 1rem;
    left: 0.5rem;
    right: 0.5rem;
  }
}
</style>
