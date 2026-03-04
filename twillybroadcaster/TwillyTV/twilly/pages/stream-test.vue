<template>
  <div class="stream-viewer">
    <div class="viewer-header">
      <h1>🎥 Live Stream Viewer</h1>
      <div class="header-controls">
        <input 
          v-model="streamKey"
          type="text" 
          placeholder="Enter stream key (e.g., sk_abc123)"
          class="stream-key-input"
          @keyup.enter="loadStream"
        >
        <button @click="loadStream" :disabled="loading" class="load-btn">
          {{ loading ? 'Loading...' : 'Load Stream' }}
        </button>
        <button @click="autoFindStream" :disabled="loading" class="find-btn">
          Find Active Stream
        </button>
      </div>
    </div>
    
    <div v-if="statusMessage" :class="['status', statusType]">
      {{ statusMessage }}
    </div>
    
    <div class="video-wrapper">
      <div v-if="streamUrl" class="player-container">
        <video
          ref="videoElement"
          id="hls-video-player"
          class="video-player"
          controls
          autoplay
          muted
          playsinline
          preload="auto"
        ></video>
        <div v-if="isLive" class="live-indicator">
          <span class="pulse"></span>
          <span>LIVE</span>
        </div>
        <div v-if="loading" class="loading-overlay">
          <div class="spinner"></div>
          <p>Loading stream...</p>
        </div>
      </div>
      <div v-else class="no-stream">
        <div class="no-stream-icon">📺</div>
        <p>No stream loaded</p>
        <p class="hint">Enter a stream key or click "Find Active Stream" to start watching</p>
      </div>
    </div>
    
    <div v-if="activeStreams.length > 0" class="active-streams-list">
      <h3>🔴 Active Streams</h3>
      <div 
        v-for="stream in activeStreams" 
        :key="stream.streamKey"
        class="stream-item"
        @click="loadStreamByKey(stream.streamKey)"
      >
        <div class="stream-info">
          <strong>{{ stream.username || stream.streamKey }}</strong>
          <span v-if="stream.title" class="stream-title">{{ stream.title }}</span>
        </div>
        <button class="watch-btn">Watch →</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import Hls from 'hls.js'

const route = useRoute()
const API_URL = 'https://twilly.app/api/streams/status'
const EC2_IP = '100.24.103.57'

const streamKey = ref('')
const streamUrl = ref('')
const statusMessage = ref('')
const statusType = ref('info')
const loading = ref(false)
const activeStreams = ref([])
const isLive = ref(false)
const videoElement = ref(null)
let autoRefreshTimer = null
let hls = null // HLS.js instance

// Auto-find active stream
async function autoFindStream() {
  loading.value = true
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    const data = await response.json()
    
    if (data.success && data.activeStreams && data.activeStreams.length > 0) {
      activeStreams.value = data.activeStreams
      loadStreamByKey(data.activeStreams[0].streamKey)
    } else {
      showStatus('No active streams found. Start streaming from your device first!', 'info')
    }
  } catch (error) {
    showStatus('Error finding active streams: ' + error.message, 'error')
  } finally {
    loading.value = false
  }
}

// Load stream by key
async function loadStreamByKey(key) {
  streamKey.value = key
  await loadStream()
}

// Main load stream function - Use HLS.js directly (simpler, more reliable)
async function loadStream() {
  if (!streamKey.value.trim()) {
    showStatus('Please enter a stream key', 'error')
    return
  }
  
  loading.value = true
  clearStatus()
  isLive.value = false
  
  try {
    // Check if stream is active
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamKey: streamKey.value })
    })
    
    const data = await response.json()
    
    if (!data.isActive) {
      streamUrl.value = ''
      isLive.value = false
      showStatus(data.message || '❌ Stream is not active. Make sure you are streaming from your mobile device and wait 15-20 seconds for HLS to generate.', 'error')
      loading.value = false
      return
    }
    
    // Use DIRECT HTTPS from EC2 - no proxy needed!
    const EC2_IP = '100.24.103.57'
    const playlistUrl = `https://${EC2_IP}/hls/${streamKey.value}/index.m3u8`
    streamUrl.value = playlistUrl
    isLive.value = true
    showStatus('✅ Stream found! Loading player...', 'success')
    
    // Wait for DOM
    await nextTick()
    
    if (!videoElement.value) {
      showStatus('❌ Video element not found. Please refresh the page.', 'error')
      loading.value = false
      return
    }
    
    // Clean up existing HLS instance
    if (hls) {
      try {
        hls.destroy()
      } catch (e) {
        console.warn('Error destroying old HLS instance:', e)
      }
      hls = null
    }
    
    const video = videoElement.value
    
    console.log('🎥 Initializing HLS.js with URL:', playlistUrl)
    
    // FORCE HLS.js for all browsers to get better error handling and debugging
    // Native HLS doesn't work well with proxied segments on Netlify serverless
    // HLS.js provides better error messages and can handle some edge cases
    if (Hls.isSupported()) {
      // Use HLS.js for ALL browsers (including Safari) for better debugging
      console.log('✅ Using HLS.js (forced for all browsers to handle proxy issues)')
      
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1, // Auto-select quality
        debug: true // Enable debug mode for detailed error messages
      })
      
      hls.loadSource(playlistUrl)
      hls.attachMedia(video)
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest parsed, starting playback')
        showStatus('✅ Stream is playing!', 'success')
        loading.value = false
        video.play().catch(err => {
          console.warn('⚠️ Autoplay prevented:', err)
          showStatus('⚠️ Click play to start stream', 'info')
        })
      })
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('❌ HLS.js error:', data)
        console.error('❌ Error details:', {
          type: data.type,
          details: data.details,
          fatal: data.fatal,
          url: data.url,
          reason: data.reason
        })
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              showStatus('❌ Network error. Make sure stream is active.', 'error')
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              showStatus('❌ Media error. Stream may have ended or segments are corrupted.', 'error')
              if (data.details === 'fragParsingError') {
                console.error('❌ Fragment parsing error - segments are corrupted. This is likely a proxy issue.')
                showStatus('❌ CRITICAL: Segments are corrupted due to Netlify proxy. Need to fix server-side binary handling.', 'error')
              }
              break
            default:
              showStatus(`❌ Fatal error: ${data.reason || data.details || 'Unknown error'}`, 'error')
              break
          }
          loading.value = false
        }
      })
      
      hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
        console.log('✅ HLS fragment loaded:', data.frag.url)
        if (loading.value) {
          loading.value = false
        }
      })
      
      hls.on(Hls.Events.FRAG_PARSING_DATA, () => {
        console.log('✅ HLS fragment parsing data')
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Fallback to native HLS only if HLS.js is not supported (shouldn't happen on modern browsers)
      console.log('⚠️ HLS.js not supported, falling back to native HLS')
      video.src = playlistUrl
      video.addEventListener('loadedmetadata', () => {
        console.log('✅ Stream metadata loaded (native HLS)')
        showStatus('✅ Stream is playing!', 'success')
        loading.value = false
        video.play().catch(err => {
          console.warn('⚠️ Autoplay prevented:', err)
          showStatus('⚠️ Click play to start stream', 'info')
        })
      })
      video.addEventListener('error', (e) => {
        console.error('❌ Native HLS error:', e)
        const error = video.error
        if (error) {
          const errorCode = error.code
          const errorMessage = error.message || getVideoErrorMessage(errorCode)
          console.error(`❌ Video error code: ${errorCode}, message: ${errorMessage}`)
          console.error('❌ Video error details:', {
            code: errorCode,
            message: errorMessage,
            networkState: video.networkState,
            readyState: video.readyState,
            src: video.src
          })
          showStatus(`❌ Error: ${errorMessage}`, 'error')
        } else {
          console.error('❌ Video error but no error object available')
          console.error('❌ Video state:', {
            networkState: video.networkState,
            readyState: video.readyState,
            src: video.src,
            error: video.error
          })
          showStatus('❌ Error loading stream. Make sure stream is active.', 'error')
        }
        loading.value = false
      })
      
      // Add more event listeners for debugging
      video.addEventListener('loadstart', () => {
        console.log('📡 Native HLS: loadstart event')
      })
      
      video.addEventListener('loadedmetadata', () => {
        console.log('📡 Native HLS: loadedmetadata event')
      })
      
      video.addEventListener('canplay', () => {
        console.log('📡 Native HLS: canplay event')
      })
      
      video.addEventListener('stalled', () => {
        console.warn('⚠️ Native HLS: stalled event - buffering')
      })
      
      video.addEventListener('waiting', () => {
        console.warn('⚠️ Native HLS: waiting event - buffering')
      })
    } else if (Hls.isSupported()) {
      // Use HLS.js for Chrome/Firefox/Android
      console.log('✅ Using HLS.js (Chrome/Firefox)')
      
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        startLevel: -1, // Auto-select quality
        debug: false
      })
      
      hls.loadSource(playlistUrl)
      hls.attachMedia(video)
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest parsed, starting playback')
        showStatus('✅ Stream is playing!', 'success')
        loading.value = false
        video.play().catch(err => {
          console.warn('⚠️ Autoplay prevented:', err)
          showStatus('⚠️ Click play to start stream', 'info')
        })
      })
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('❌ HLS.js error:', data)
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              showStatus('❌ Network error. Make sure stream is active.', 'error')
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              showStatus('❌ Media error. Stream may have ended or segments are corrupted.', 'error')
              break
            default:
              showStatus('❌ Fatal error loading stream. Try refreshing.', 'error')
              break
          }
          loading.value = false
        }
      })
      
      hls.on(Hls.Events.FRAG_LOADED, () => {
        if (loading.value) {
          console.log('✅ HLS fragment loaded')
          loading.value = false
        }
      })
    } else {
      showStatus('❌ Your browser does not support HLS playback.', 'error')
      loading.value = false
      return
    }
    
    // Timeout fallback
    setTimeout(() => {
      if (loading.value) {
        console.warn('⏱️ Stream loading timeout')
        showStatus('⏱️ Stream is taking longer than expected. Check browser console for errors.', 'info')
        loading.value = false
      }
    }, 15000)
    
    // Start auto-refresh
    startAutoRefresh()
    
  } catch (error) {
    console.error('Error loading stream:', error)
    showStatus('Error loading stream: ' + error.message, 'error')
    loading.value = false
  }
}

function getVideoErrorMessage(code) {
  switch(code) {
    case 1: return 'Loading aborted'
    case 2: return 'Network error. Make sure stream is active.'
    case 3: return 'Decode error. Stream format issue.'
    case 4: return 'Stream not found or format not supported. Wait 15-20 seconds after starting stream.'
    default: return 'Unknown error'
  }
}

function showStatus(message, type = 'info') {
  statusMessage.value = message
  statusType.value = type
  if (type === 'success' || type === 'error') {
    setTimeout(clearStatus, 5000)
  }
}

function clearStatus() {
  statusMessage.value = ''
}

// Video.js handles errors internally, but keep these for compatibility
function handleVideoError(event) {
  console.error('Video error event:', event)
}

function handleVideoLoaded() {
  console.log('✅ Video loaded event fired')
}

function handleVideoCanPlay() {
  console.log('✅ Video can play event fired')
}

function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
  
  autoRefreshTimer = setInterval(async () => {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await response.json()
      if (data.success && data.activeStreams) {
        activeStreams.value = data.activeStreams
      }
    } catch (error) {
      console.error('Error refreshing streams:', error)
    }
  }, 10000)
}

onMounted(async () => {
  const urlKey = route.query.key
  if (urlKey) {
    streamKey.value = urlKey
    await loadStream()
  } else {
    // Auto-find and load active streams on page load
    await autoFindStream()
  }
})

onUnmounted(() => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
  }
  if (hls) {
    try {
      hls.destroy()
    } catch (e) {
      console.warn('Error destroying HLS instance on unmount:', e)
    }
    hls = null
  }
})
</script>

<style scoped>
.stream-viewer {
  min-height: 100vh;
  background: #0e0e10;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.viewer-header {
  background: #18181b;
  padding: 20px;
  border-bottom: 1px solid #2d2d35;
}

.viewer-header h1 {
  margin: 0 0 15px 0;
  font-size: 24px;
  color: #efeff1;
}

.header-controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.stream-key-input {
  flex: 1;
  min-width: 200px;
  padding: 10px 15px;
  background: #0e0e10;
  border: 1px solid #2d2d35;
  border-radius: 4px;
  color: #efeff1;
  font-size: 14px;
}

.stream-key-input:focus {
  outline: none;
  border-color: #9147ff;
}

.load-btn, .find-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.load-btn {
  background: #9147ff;
  color: white;
}

.load-btn:hover:not(:disabled) {
  background: #772ce8;
}

.load-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.find-btn {
  background: #2d2d35;
  color: #efeff1;
}

.find-btn:hover:not(:disabled) {
  background: #3d3d45;
}

.status {
  padding: 15px 20px;
  margin: 0 20px;
  border-radius: 4px;
  margin-top: 15px;
}

.status.success {
  background: #0e7c0e;
  color: white;
}

.status.error {
  background: #e91916;
  color: white;
}

.status.info {
  background: #1f69ff;
  color: white;
}

.video-wrapper {
  padding: 20px;
}

.player-container {
  position: relative;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  max-width: 1920px;
  margin: 0 auto;
}

/* Video.js player styles - matching Twilly app */
.player-container :deep(.video-js) {
  width: 100% !important;
  height: auto !important;
  min-height: 400px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.player-container :deep(.video-js .vjs-tech) {
  width: 100% !important;
  height: auto !important;
  object-fit: contain;
}

.player-container :deep(.video-js.vjs-fluid) {
  padding-top: 56.25% !important; /* 16:9 aspect ratio */
}

.player-container :deep(.video-js .vjs-poster) {
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
}

.player-container :deep(.video-js .vjs-big-play-button) {
  background-color: rgba(145, 71, 255, 0.8);
  border: none;
  border-radius: 50%;
  width: 3em;
  height: 3em;
  line-height: 3em;
  font-size: 1.5em;
}

.player-container :deep(.video-js .vjs-big-play-button:hover) {
  background-color: rgba(145, 71, 255, 1);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 5;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: #9147ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-help {
  display: block;
  margin-top: 10px;
}

.error-help small {
  font-size: 12px;
  opacity: 0.9;
}

.live-indicator {
  position: absolute;
  top: 15px;
  left: 15px;
  background: #e91916;
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10;
}

.pulse {
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.no-stream {
  text-align: center;
  padding: 60px 20px;
  color: #adadb8;
}

.no-stream-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.no-stream p {
  margin: 10px 0;
  font-size: 16px;
}

.no-stream .hint {
  font-size: 14px;
  color: #737373;
}

.active-streams-list {
  padding: 20px;
  max-width: 1920px;
  margin: 0 auto;
}

.active-streams-list h3 {
  margin: 0 0 15px 0;
  color: #efeff1;
}

.stream-item {
  background: #18181b;
  border: 1px solid #2d2d35;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.stream-item:hover {
  background: #1f1f23;
  border-color: #9147ff;
}

.stream-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stream-info strong {
  color: #efeff1;
  font-size: 16px;
}

.stream-title {
  color: #adadb8;
  font-size: 14px;
}

.watch-btn {
  background: #9147ff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
}

.watch-btn:hover {
  background: #772ce8;
}

@media (max-width: 768px) {
  .header-controls {
    flex-direction: column;
  }
  
  .stream-key-input {
    width: 100%;
  }
  
  .load-btn, .find-btn {
    width: 100%;
  }
}
</style>
