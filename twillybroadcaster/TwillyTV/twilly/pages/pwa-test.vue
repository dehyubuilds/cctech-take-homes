<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black p-4">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl md:text-4xl font-bold text-white mb-4">
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
            PWA Test Page
          </span>
        </h1>
        <p class="text-gray-300 text-lg">
          Debug and test PWA functionality
        </p>
      </div>
      
      <!-- Test Controls -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 mb-8">
        <h2 class="text-xl font-semibold text-white mb-4">Test Controls</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            @click="runPWACheck"
            class="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-all duration-300"
          >
            🔧 Run PWA Check
          </button>
          
          <button
            @click="testServiceWorker"
            class="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-all duration-300"
          >
            🚀 Test Service Worker
          </button>
          
          <button
            @click="testManifest"
            class="px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-all duration-300"
          >
            📋 Test Manifest
          </button>
          
          <button
            @click="testOffline"
            class="px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition-all duration-300"
          >
            📱 Test Offline
          </button>
        </div>
      </div>
      
      <!-- Test Results -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 mb-8">
        <h2 class="text-xl font-semibold text-white mb-4">Test Results</h2>
        
        <div class="space-y-4">
          <div v-if="testResults.pwaCheck" class="p-4 bg-black/20 rounded-lg">
            <h3 class="text-lg font-medium text-white mb-2">PWA Check Results</h3>
            <pre class="text-sm text-gray-300 overflow-x-auto">{{ JSON.stringify(testResults.pwaCheck, null, 2) }}</pre>
          </div>
          
          <div v-if="testResults.serviceWorker" class="p-4 bg-black/20 rounded-lg">
            <h3 class="text-lg font-medium text-white mb-2">Service Worker Test</h3>
            <pre class="text-sm text-gray-300 overflow-x-auto">{{ JSON.stringify(testResults.serviceWorker, null, 2) }}</pre>
          </div>
          
          <div v-if="testResults.manifest" class="p-4 bg-black/20 rounded-lg">
            <h3 class="text-lg font-medium text-white mb-2">Manifest Test</h3>
            <pre class="text-sm text-gray-300 overflow-x-auto">{{ JSON.stringify(testResults.manifest, null, 2) }}</pre>
          </div>
          
          <div v-if="testResults.offline" class="p-4 bg-black/20 rounded-lg">
            <h3 class="text-lg font-medium text-white mb-2">Offline Test</h3>
            <pre class="text-sm text-gray-300 overflow-x-auto">{{ JSON.stringify(testResults.offline, null, 2) }}</pre>
          </div>
        </div>
      </div>
      
      <!-- Manual Tests -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 mb-8">
        <h2 class="text-xl font-semibold text-white mb-4">Manual Tests</h2>
        
        <div class="space-y-4 text-gray-300">
          <div class="flex items-start gap-3">
            <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 class="font-medium text-white mb-1">Check Browser Console</h3>
              <p class="text-sm">Open DevTools (F12) and look for PWA debug messages</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <Icon name="heroicons:device-phone-mobile" class="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 class="font-medium text-white mb-1">Test on Mobile</h3>
              <p class="text-sm">Open this page on your iPhone Safari and check for "Add to Home Screen" option</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <Icon name="heroicons:arrow-down-tray" class="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 class="font-medium text-white mb-1">Look for Install Prompt</h3>
              <p class="text-sm">Check browser address bar for install icon or floating install button</p>
            </div>
          </div>
          
          <div class="flex items-start gap-3">
            <Icon name="heroicons:wifi" class="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 class="font-medium text-white mb-1">Test Offline</h3>
              <p class="text-sm">Disconnect internet and refresh page to test offline functionality</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Browser Info -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-gray-500/30 p-6">
        <h2 class="text-xl font-semibold text-white mb-4">Browser Information</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-400">User Agent:</span>
              <span class="text-white">{{ browserInfo.userAgent }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Platform:</span>
              <span class="text-white">{{ browserInfo.platform }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Protocol:</span>
              <span class="text-white">{{ browserInfo.protocol }}</span>
            </div>
          </div>
          
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-400">Service Worker:</span>
              <span class="text-white">{{ browserInfo.serviceWorker ? '✅' : '❌' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Push Manager:</span>
              <span class="text-white">{{ browserInfo.pushManager ? '✅' : '❌' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Cache API:</span>
              <span class="text-white">{{ browserInfo.cacheAPI ? '✅' : '❌' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const testResults = ref({
  pwaCheck: null,
  serviceWorker: null,
  manifest: null,
  offline: null
})

const browserInfo = ref({
  userAgent: '',
  platform: '',
  protocol: '',
  serviceWorker: false,
  pushManager: false,
  cacheAPI: false
})

const runPWACheck = async () => {
  try {
    console.log('🔧 PWA Test: Running PWA check...')
    
    if (window.pwaDebug && window.pwaDebug.runCheck) {
      const result = await window.pwaDebug.runCheck()
      testResults.value.pwaCheck = result
      console.log('🔧 PWA Test: PWA check completed:', result)
    } else {
      console.error('❌ PWA Test: PWA debug not available')
      testResults.value.pwaCheck = { error: 'PWA debug not available' }
    }
  } catch (error) {
    console.error('❌ PWA Test: PWA check failed:', error)
    testResults.value.pwaCheck = { error: error.message }
  }
}

const testServiceWorker = async () => {
  try {
    console.log('🔧 PWA Test: Testing service worker...')
    
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      testResults.value.serviceWorker = {
        supported: true,
        registered: !!registration,
        registration: registration ? {
          scope: registration.scope,
          active: !!registration.active,
          waiting: !!registration.waiting,
          installing: !!registration.installing
        } : null
      }
    } else {
      testResults.value.serviceWorker = { supported: false }
    }
  } catch (error) {
    console.error('❌ PWA Test: Service worker test failed:', error)
    testResults.value.serviceWorker = { error: error.message }
  }
}

const testManifest = async () => {
  try {
    console.log('🔧 PWA Test: Testing manifest...')
    
    const manifestLink = document.querySelector('link[rel="manifest"]')
    if (manifestLink) {
      const response = await fetch(manifestLink.href)
      if (response.ok) {
        const manifest = await response.json()
        testResults.value.manifest = {
          found: true,
          url: manifestLink.href,
          data: manifest
        }
      } else {
        testResults.value.manifest = { found: false, error: `HTTP ${response.status}` }
      }
    } else {
      testResults.value.manifest = { found: false, error: 'No manifest link found' }
    }
  } catch (error) {
    console.error('❌ PWA Test: Manifest test failed:', error)
    testResults.value.manifest = { error: error.message }
  }
}

const testOffline = async () => {
  try {
    console.log('🔧 PWA Test: Testing offline capability...')
    
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      testResults.value.offline = {
        supported: true,
        cacheNames,
        cacheCount: cacheNames.length
      }
    } else {
      testResults.value.offline = { supported: false }
    }
  } catch (error) {
    console.error('❌ PWA Test: Offline test failed:', error)
    testResults.value.offline = { error: error.message }
  }
}

onMounted(() => {
  if (process.client) {
    browserInfo.value = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      protocol: window.location.protocol,
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window,
      cacheAPI: 'caches' in window
    }
  }
})
</script>

<style scoped>
pre {
  background: rgba(0, 0, 0, 0.3);
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
