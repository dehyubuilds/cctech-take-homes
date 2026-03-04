<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black p-4">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl md:text-4xl font-bold text-white mb-4">
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
            PWA Debug Status
          </span>
        </h1>
        <p class="text-gray-300 text-lg">
          Current PWA functionality status
        </p>
      </div>
      
      <!-- PWA Status -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 mb-8">
        <h2 class="text-xl font-semibold text-white mb-4">PWA Status</h2>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
            <span class="text-gray-300">Manifest Link</span>
            <div class="flex items-center gap-2">
              <div 
                class="w-3 h-3 rounded-full"
                :class="pwaStatus.manifest ? 'bg-green-500' : 'bg-red-500'"
              ></div>
              <span class="text-sm font-medium" :class="pwaStatus.manifest ? 'text-green-400' : 'text-red-400'">
                {{ pwaStatus.manifest ? 'Found' : 'Missing' }}
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
                {{ pwaStatus.serviceWorker ? 'Registered' : 'Not Registered' }}
              </span>
            </div>
          </div>
          
          <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
            <span class="text-gray-300">Install Prompt</span>
            <div class="flex items-center gap-2">
              <div 
                class="w-3 h-3 rounded-full"
                :class="pwaStatus.installPrompt ? 'bg-green-500' : 'bg-yellow-500'"
              ></div>
              <span class="text-sm font-medium" :class="pwaStatus.installPrompt ? 'text-green-400' : 'text-yellow-400'">
                {{ pwaStatus.installPrompt ? 'Available' : 'Not Available' }}
              </span>
            </div>
          </div>
          
          <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
            <span class="text-gray-300">HTTPS</span>
            <div class="flex items-center gap-2">
              <div 
                class="w-3 h-3 rounded-full"
                :class="pwaStatus.https ? 'bg-green-500' : 'bg-red-500'"
              ></div>
              <span class="text-sm font-medium" :class="pwaStatus.https ? 'text-green-400' : 'text-red-400'">
                {{ pwaStatus.https ? 'Secure' : 'Not Secure' }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Test Results -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 mb-8">
        <h2 class="text-xl font-semibold text-white mb-4">Test Results</h2>
        
        <div class="space-y-4">
          <div v-if="testResults.manifest" class="p-4 bg-black/20 rounded-lg">
            <h3 class="text-lg font-medium text-white mb-2">Manifest Test</h3>
            <pre class="text-sm text-gray-300 overflow-x-auto">{{ JSON.stringify(testResults.manifest, null, 2) }}</pre>
          </div>
          
          <div v-if="testResults.serviceWorker" class="p-4 bg-black/20 rounded-lg">
            <h3 class="text-lg font-medium text-white mb-2">Service Worker Test</h3>
            <pre class="text-sm text-gray-300 overflow-x-auto">{{ JSON.stringify(testResults.serviceWorker, null, 2) }}</pre>
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
        <h2 class="text-xl font-semibold text-white mb-4">Actions</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            @click="testManifest"
            class="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-all duration-300"
          >
            🔧 Test Manifest
          </button>
          
          <button
            @click="testServiceWorker"
            class="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-all duration-300"
          >
            🚀 Test Service Worker
          </button>
          
          <button
            @click="runPWACheck"
            class="px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition-all duration-300"
          >
            📊 Run PWA Check
          </button>
          
          <button
            @click="checkConsole"
            class="px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 transition-all duration-300"
          >
            📝 Check Console
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const pwaStatus = ref({
  manifest: false,
  serviceWorker: false,
  installPrompt: false,
  https: false
})

const testResults = ref({
  manifest: null,
  serviceWorker: null
})

const testManifest = async () => {
  try {
    console.log('🔧 PWA Debug: Testing manifest...')
    
    const manifestLink = document.querySelector('link[rel="manifest"]')
    if (manifestLink) {
      console.log('🔧 PWA Debug: Manifest link found:', manifestLink.href)
      
      const response = await fetch(manifestLink.href)
      if (response.ok) {
        const manifest = await response.json()
        console.log('🔧 PWA Debug: Manifest loaded successfully:', manifest)
        testResults.value.manifest = manifest
        pwaStatus.value.manifest = true
      } else {
        console.error('❌ PWA Debug: Manifest fetch failed:', response.status)
        testResults.value.manifest = { error: `HTTP ${response.status}` }
        pwaStatus.value.manifest = false
      }
    } else {
      console.error('❌ PWA Debug: No manifest link found')
      testResults.value.manifest = { error: 'No manifest link found' }
      pwaStatus.value.manifest = false
    }
  } catch (error) {
    console.error('❌ PWA Debug: Manifest test failed:', error)
    testResults.value.manifest = { error: error.message }
    pwaStatus.value.manifest = false
  }
}

const testServiceWorker = async () => {
  try {
    console.log('🔧 PWA Debug: Testing service worker...')
    
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        console.log('🔧 PWA Debug: Service Worker registered:', registration)
        testResults.value.serviceWorker = {
          registered: true,
          scope: registration.scope,
          active: !!registration.active
        }
        pwaStatus.value.serviceWorker = true
      } else {
        console.log('🔧 PWA Debug: No service worker registration found')
        testResults.value.serviceWorker = { registered: false, error: 'No registration found' }
        pwaStatus.value.serviceWorker = false
      }
    } else {
      console.log('🔧 PWA Debug: Service Worker not supported')
      testResults.value.serviceWorker = { supported: false, error: 'Not supported' }
      pwaStatus.value.serviceWorker = false
    }
  } catch (error) {
    console.error('❌ PWA Debug: Service worker test failed:', error)
    testResults.value.serviceWorker = { error: error.message }
    pwaStatus.value.serviceWorker = false
  }
}

const runPWACheck = async () => {
  try {
    console.log('🔧 PWA Debug: Running PWA check...')
    
    if (window.pwaDebug && window.pwaDebug.runCheck) {
      const result = await window.pwaDebug.runCheck()
      console.log('🔧 PWA Debug: PWA check completed:', result)
    } else {
      console.error('❌ PWA Debug: PWA debug not available')
    }
  } catch (error) {
    console.error('❌ PWA Debug: PWA check failed:', error)
  }
}

const checkConsole = () => {
  alert('Check the browser console (F12) for detailed PWA debug information!')
}

onMounted(() => {
  if (process.client) {
    // Check HTTPS
    pwaStatus.value.https = window.location.protocol === 'https:'
    
    // Check manifest link
    const manifestLink = document.querySelector('link[rel="manifest"]')
    pwaStatus.value.manifest = !!manifestLink
    
    // Check service worker
    pwaStatus.value.serviceWorker = 'serviceWorker' in navigator
    
    // Check install prompt
    pwaStatus.value.installPrompt = !!window.deferredPrompt
    
    console.log('🔧 PWA Debug: Initial status:', pwaStatus.value)
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
