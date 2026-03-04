<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black p-4">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl md:text-4xl font-bold text-white mb-4">
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
            PWA Settings
          </span>
        </h1>
        <p class="text-gray-300 text-lg">
          Customize your Twilly app experience
        </p>
      </div>
      
      <!-- PWA Status -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 mb-8">
        <h2 class="text-xl font-semibold text-white mb-4">App Status</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-4">
            <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span class="text-gray-300">Installation Status</span>
              <div class="flex items-center gap-2">
                <div 
                  class="w-3 h-3 rounded-full"
                  :class="pwaStatus.isInstalled ? 'bg-green-500' : 'bg-yellow-500'"
                ></div>
                <span class="text-sm font-medium" :class="pwaStatus.isInstalled ? 'text-green-400' : 'text-yellow-400'">
                  {{ pwaStatus.isInstalled ? 'Installed' : 'Not Installed' }}
                </span>
              </div>
            </div>
            
            <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span class="text-gray-300">Service Worker</span>
              <div class="flex items-center gap-2">
                <div 
                  class="w-3 h-3 rounded-full"
                  :class="pwaStatus.serviceWorker ? 'bg-green-500' : 'bg-red-500'"
                ></div>
                <span class="text-sm font-medium" :class="pwaStatus.serviceWorker ? 'text-green-400' : 'text-red-400'">
                  {{ pwaStatus.serviceWorker ? 'Active' : 'Inactive' }}
                </span>
              </div>
            </div>
            
            <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span class="text-gray-300">Offline Support</span>
              <div class="flex items-center gap-2">
                <div 
                  class="w-3 h-3 rounded-full"
                  :class="pwaStatus.offline ? 'bg-green-500' : 'bg-red-500'"
                ></div>
                <span class="text-sm font-medium" :class="pwaStatus.offline ? 'text-green-400' : 'text-red-400'">
                  {{ pwaStatus.offline ? 'Available' : 'Unavailable' }}
                </span>
              </div>
            </div>
          </div>
          
          <div class="space-y-4">
            <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span class="text-gray-300">Push Notifications</span>
              <div class="flex items-center gap-2">
                <div 
                  class="w-3 h-3 rounded-full"
                  :class="pwaStatus.pushNotifications ? 'bg-green-500' : 'bg-red-500'"
                ></div>
                <span class="text-sm font-medium" :class="pwaStatus.pushNotifications ? 'text-green-400' : 'text-red-400'">
                  {{ pwaStatus.pushNotifications ? 'Enabled' : 'Disabled' }}
                </span>
              </div>
            </div>
            
            <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span class="text-gray-300">Background Sync</span>
              <div class="flex items-center gap-2">
                <div 
                  class="w-3 h-3 rounded-full"
                  :class="pwaStatus.backgroundSync ? 'bg-green-500' : 'bg-red-500'"
                ></div>
                <span class="text-sm font-medium" :class="pwaStatus.backgroundSync ? 'text-green-400' : 'text-red-400'">
                  {{ pwaStatus.backgroundSync ? 'Available' : 'Unavailable' }}
                </span>
              </div>
            </div>
            
            <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <span class="text-gray-300">Cache Storage</span>
              <div class="flex items-center gap-2">
                <div 
                  class="w-3 h-3 rounded-full"
                  :class="pwaStatus.cacheStorage ? 'bg-green-500' : 'bg-red-500'"
                ></div>
                <span class="text-sm font-medium" :class="pwaStatus.backgroundSync ? 'text-green-400' : 'text-red-400'">
                  {{ pwaStatus.cacheStorage ? 'Available' : 'Unavailable' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- PWA Actions -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 mb-8">
        <h2 class="text-xl font-semibold text-white mb-4">App Actions</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            v-if="!pwaStatus.isInstalled && pwaStatus.canInstall"
            @click="installApp"
            class="px-6 py-3 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 transition-all duration-300 transform hover:scale-105 active:scale-95"
          >
            <Icon name="heroicons:arrow-down-tray" class="w-5 h-5 inline mr-2" />
            Install App
          </button>
          
          <button
            v-if="pwaStatus.isInstalled"
            @click="uninstallApp"
            class="px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-all duration-300 transform hover:scale-105 active:scale-95"
          >
            <Icon name="heroicons:trash" class="w-5 h-5 inline mr-2" />
            Uninstall App
          </button>
          
          <button
            @click="clearCache"
            class="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-all duration-300 transform hover:scale-105 active:scale-95"
          >
            <Icon name="heroicons:arrow-path" class="w-5 h-5 inline mr-2" />
            Clear Cache
          </button>
          
          <button
            @click="updateApp"
            class="px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-all duration-300 transform hover:scale-105 active:scale-95"
          >
            <Icon name="heroicons:arrow-up-tray" class="w-5 h-5 inline mr-2" />
            Check for Updates
          </button>
        </div>
      </div>
      
      <!-- Push Notification Settings -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 mb-8">
        <PushNotificationSettings />
      </div>
      
      <!-- Cache Information -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 mb-8">
        <h2 class="text-xl font-semibold text-white mb-4">Cache Information</h2>
        
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="text-center p-4 bg-black/20 rounded-lg">
              <div class="text-2xl font-bold text-teal-400">{{ cacheInfo.static }}</div>
              <div class="text-sm text-gray-400">Static Files</div>
            </div>
            
            <div class="text-center p-4 bg-black/20 rounded-lg">
              <div class="text-2xl font-bold text-blue-400">{{ cacheInfo.dynamic }}</div>
              <div class="text-sm text-gray-400">Dynamic Content</div>
            </div>
            
            <div class="text-center p-4 bg-black/20 rounded-lg">
              <div class="text-2xl font-bold text-purple-400">{{ cacheInfo.api }}</div>
              <div class="text-sm text-gray-400">API Responses</div>
            </div>
          </div>
          
          <div class="text-center">
            <button
              @click="refreshCacheInfo"
              class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Icon name="heroicons:arrow-path" class="w-4 h-4 inline mr-2" />
              Refresh Cache Info
            </button>
          </div>
        </div>
      </div>
      
      <!-- Help Section -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-500/30 p-6">
        <h2 class="text-xl font-semibold text-white mb-4">PWA Help</h2>
        
        <div class="space-y-4 text-gray-300">
          <div class="flex items-start gap-3">
            <Icon name="heroicons:question-mark-circle" class="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 class="font-medium text-white mb-1">What is a PWA?</h3>
              <p class="text-sm">A Progressive Web App (PWA) is a web application that provides a native app-like experience. You can install it on your device and use it offline.</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <Icon name="heroicons:device-phone-mobile" class="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 class="font-medium text-white mb-1">How to Install?</h3>
              <p class="text-sm">Click the "Install App" button above, or look for the install prompt in your browser's address bar. On mobile, you can also add to home screen from the browser menu.</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <Icon name="heroicons:wifi" class="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 class="font-medium text-white mb-1">Offline Usage</h3>
              <p class="text-sm">Once installed, you can access previously viewed content even when offline. The app will automatically sync when you're back online.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const { $pwa, $offline, $pushNotifications } = useNuxtApp()

// PWA status
const pwaStatus = ref({
  isInstalled: false,
  canInstall: false,
  serviceWorker: false,
  offline: false,
  pushNotifications: false,
  backgroundSync: false,
  cacheStorage: false
})

// Cache information
const cacheInfo = ref({
  static: 0,
  dynamic: 0,
  api: 0
})

// Install app
const installApp = async () => {
  try {
    await $pwa.promptInstall()
  } catch (error) {
    console.error('Install failed:', error)
  }
}

// Uninstall app (this is handled by the OS, we can only provide guidance)
const uninstallApp = () => {
  alert('To uninstall the app, go to your device settings and remove Twilly from the apps list.')
}

// Clear cache
const clearCache = async () => {
  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
      
      // Refresh cache info
      await refreshCacheInfo()
      
      alert('Cache cleared successfully!')
    }
  } catch (error) {
    console.error('Failed to clear cache:', error)
    alert('Failed to clear cache')
  }
}

// Update app
const updateApp = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.update()
      alert('Checking for updates...')
    })
  }
}

// Refresh cache information
const refreshCacheInfo = async () => {
  try {
    if ('caches' in window) {
      const staticCache = await caches.open('twilly-static-v1.0.0')
      const dynamicCache = await caches.open('twilly-dynamic-v1.0.0')
      const apiCache = await caches.open('twilly-api-v1.0.0')
      
      const staticKeys = await staticCache.keys()
      const dynamicKeys = await dynamicCache.keys()
      const apiKeys = await apiCache.keys()
      
      cacheInfo.value = {
        static: staticKeys.length,
        dynamic: dynamicKeys.length,
        api: apiKeys.length
      }
    }
  } catch (error) {
    console.error('Failed to get cache info:', error)
  }
}

// Check PWA status
const checkPWAStatus = () => {
  // Check if app is installed
  pwaStatus.value.isInstalled = $pwa.isInstalled()
  
  // Check if install is available
  pwaStatus.value.canInstall = $pwa.isInstallAvailable()
  
  // Check service worker
  pwaStatus.value.serviceWorker = 'serviceWorker' in navigator
  
  // Check offline support
  pwaStatus.value.offline = !!$offline
  
  // Check push notifications
  pwaStatus.value.pushNotifications = 'PushManager' in window
  
  // Check background sync
  pwaStatus.value.backgroundSync = 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype
  
  // Check cache storage
  pwaStatus.value.cacheStorage = 'caches' in window
}

onMounted(async () => {
  // Check PWA status
  checkPWAStatus()
  
  // Get cache information
  await refreshCacheInfo()
  
  // Listen for PWA events
  window.addEventListener('twilly-install-available', checkPWAStatus)
  window.addEventListener('twilly-installed', checkPWAStatus)
})
</script>

<style scoped>
/* Custom styling for PWA settings */
.grid {
  display: grid;
}

@media (max-width: 768px) {
  .grid-cols-2 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
  
  .grid-cols-3 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}
</style>
