// Twilly Service Worker
// This service worker provides offline functionality, push notifications, and background sync

const CACHE_NAME = 'twilly-v1.0.1'
const STATIC_CACHE = 'twilly-static-v1.0.1'
const DYNAMIC_CACHE = 'twilly-dynamic-v1.0.1'
const API_CACHE = 'twilly-api-v1.0.1'

// Check if we're in development mode
const isDevelopment = self.location.hostname.includes('localhost') || 
                     self.location.hostname.includes('127.0.0.1') ||
                     self.location.hostname.includes('0.0.0.0')

// Enhanced logging for debugging
const log = (message, data = null) => {
  const timestamp = new Date().toISOString()
  console.log(`🔧 SW [${timestamp}]: ${message}`, data || '')
}

const logError = (message, error = null) => {
  const timestamp = new Date().toISOString()
  console.error(`❌ SW [${timestamp}]: ${message}`, error || '')
}

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/offline',
  '/site.webmanifest',
  '/favicon.ico'
]

// Install event - cache static files
self.addEventListener('install', (event) => {
  log('🚀 Service Worker installing...')
  
  if (isDevelopment) {
    log('🔧 Development mode detected - minimal caching')
    event.waitUntil(self.skipWaiting())
    return
  }
  
  event.waitUntil(
    Promise.all([
      // Force immediate activation
      self.skipWaiting(),
      // Cache static files
      caches.open(STATIC_CACHE)
        .then((cache) => {
          log('📦 Caching static files')
          return cache.addAll(STATIC_FILES)
        })
        .then(() => {
          log('✅ Service Worker installed successfully')
        })
        .catch((error) => {
          logError('❌ Service Worker installation failed:', error)
        })
    ])
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker activating...')
  
  event.waitUntil(
    Promise.all([
      // Claim all clients immediately to activate new SW
      self.clients.claim(),
      // Clean up old caches
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== STATIC_CACHE && 
                  cacheName !== DYNAMIC_CACHE && 
                  cacheName !== API_CACHE &&
                  cacheName !== CACHE_NAME) {
                console.log('🗑️ Deleting old cache:', cacheName)
                return caches.delete(cacheName)
              }
            })
          )
        })
        .then(() => {
          console.log('✅ Service Worker activated successfully')
        })
    ])
  )
})

// Fetch event - handle requests and caching
self.addEventListener('fetch', (event) => {
  // In development mode, don't intercept any requests to avoid conflicts
  if (isDevelopment) {
    return
  }
  
  const { request } = event
  const url = new URL(request.url)
  const requestUrl = request.url.toLowerCase()
  const pathname = url.pathname.toLowerCase()
  
  // CRITICAL: Completely bypass service worker for HLS streams (check VERY FIRST)
  // HLS segments return 206 Partial Content which CANNOT be cached by Cache API
  // Check both URL and pathname to catch all variations
  if (pathname.includes('/api/streams/hls/') || 
      requestUrl.includes('/api/streams/hls/') ||
      pathname.endsWith('.m3u8') || 
      requestUrl.endsWith('.m3u8') ||
      pathname.endsWith('.ts') ||
      requestUrl.endsWith('.ts')) {
    // HLS streams - completely bypass service worker (don't respond, let browser handle)
    // Return IMMEDIATELY without ANY processing - browser will fetch directly
    return // Don't call event.respondWith() - browser handles directly, bypasses SW completely
  }
  
  // Skip non-GET requests (after HLS bypass check)
  if (request.method !== 'GET') {
    return
  }
  
  // Log the request for debugging (after HLS bypass check)
  log(`Fetch request: ${request.method} ${url.href}`)
  
  // Handle different types of requests
  if (url.pathname === '/') {
    // Home page - cache first with network fallback
    log('Handling home page request with cache first')
    event.respondWith(cacheFirst(request, STATIC_CACHE))
  } else if (url.pathname.startsWith('/api/')) {
    // API requests - network first with cache fallback (except HLS streams)
    log('Handling API request with network first')
    event.respondWith(networkFirst(request, API_CACHE))
  } else if (url.pathname.startsWith('/_nuxt/')) {
    // Static assets - cache first
    log('Handling static asset request with cache first')
    event.respondWith(cacheFirst(request, STATIC_CACHE))
  } else if (url.hostname.includes('cloudfront.net')) {
    // Media files - cache first (but skip if HLS)
    log('Handling media file request with cache first')
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE))
  } else {
    // Other requests - network first
    log('Handling other request with network first')
    event.respondWith(networkFirst(request, DYNAMIC_CACHE))
  }
})

// Cache first strategy
async function cacheFirst(request, cacheName) {
  try {
    // Don't use cache for HLS streams - they must be fresh
    if (request.url.includes('/api/streams/hls/') || 
        request.url.endsWith('.m3u8') || 
        request.url.endsWith('.ts')) {
      return fetch(request)
    }
    
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    const networkResponse = await fetch(request)
    // Don't cache partial responses (206) - used for video segments
    if (networkResponse.ok && networkResponse.status !== 206) {
      try {
        const cache = await caches.open(cacheName)
        await cache.put(request, networkResponse.clone())
      } catch (cacheError) {
        // If caching fails (e.g., 206 response), just continue without caching
        log('Cache put failed (may be partial response):', cacheError.message)
      }
    }
    
    return networkResponse
  } catch (error) {
    logError('Cache first failed:', error)
    
    // For development URLs, just return the error response
    if (request.url.includes('localhost') || request.url.includes('127.0.0.1')) {
      return new Response('Development URL - not cached', { status: 404 })
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline')
    }
    
    // For other errors, return a simple error response instead of throwing
    return new Response('Network error', { status: 503 })
  }
}

// Network first strategy
async function networkFirst(request, cacheName) {
  try {
    // Double-check: don't handle HLS streams here (should be bypassed earlier)
    if (request.url.includes('/api/streams/hls/') || 
        request.url.endsWith('.m3u8') || 
        request.url.endsWith('.ts')) {
      // This shouldn't happen, but if it does, just fetch directly
      log('HLS stream detected in networkFirst - fetching directly (should be bypassed)')
      return fetch(request)
    }
    
    const networkResponse = await fetch(request)
    
    // Don't cache partial responses (206) - these are used for video segments with range requests
    // Also don't cache HLS streams (double-check)
    if (networkResponse.ok && 
        networkResponse.status !== 206 && 
        !request.url.includes('/api/streams/hls/') &&
        !request.url.endsWith('.m3u8') &&
        !request.url.endsWith('.ts')) {
      try {
        const cache = await caches.open(cacheName)
        await cache.put(request, networkResponse.clone())
      } catch (cacheError) {
        // If caching fails (e.g., 206 response), just continue without caching
        // Silently ignore - don't log to avoid spam
      }
    }
    
    return networkResponse
  } catch (error) {
    logError('Network first failed:', error)
    
    // For development URLs, just return the error response
    if (request.url.includes('localhost') || request.url.includes('127.0.0.1')) {
      return new Response('Development URL - not cached', { status: 404 })
    }
    
    // Don't use cache for HLS streams even on error
    if (request.url.includes('/api/streams/hls/') || 
        request.url.endsWith('.m3u8') || 
        request.url.endsWith('.ts')) {
      // Return error response for HLS streams (don't try to use cache)
      return new Response('Network error', { status: 503 })
    }
    
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline')
    }
    
    // For other errors, return a simple error response instead of throwing
    return new Response('Network error', { status: 503 })
  }
}

// Push notification event
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received:', event)
  
  if (event.data) {
    try {
      const data = event.data.json()
      const options = {
        body: data.body || 'New content available on Twilly!',
        icon: '/twillyicon.png',
        badge: '/twillyicon.png',
        tag: 'twilly-notification',
        requireInteraction: false,
        silent: false,
        data: data.data || {},
        actions: data.actions || []
      }
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'Twilly', options)
      )
    } catch (error) {
      console.error('Error parsing push data:', error)
      
      // Fallback notification
      const options = {
        body: 'New content available on Twilly!',
        icon: '/twillyicon.png',
        badge: '/twillyicon.png'
      }
      
      event.waitUntil(
        self.registration.showNotification('Twilly', options)
      )
    }
  }
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event)
  
  event.notification.close()
  
  if (event.action) {
    // Handle custom actions
    console.log('Action clicked:', event.action)
  } else {
    // Default click behavior
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then((clientList) => {
          // Focus existing window if available
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus()
            }
          }
          
          // Open new window if none exists
          if (clients.openWindow) {
            return clients.openWindow('/')
          }
        })
    )
  }
})

// Background sync event
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync:', event.tag)
  
  if (event.tag === 'twilly-offline-queue') {
    event.waitUntil(syncOfflineActions())
  }
})

// Sync offline actions
async function syncOfflineActions() {
  try {
    console.log('🔄 Syncing offline actions...')
    
    // Get pending actions from IndexedDB or localStorage
    const pendingActions = await getPendingActions()
    
    for (const action of pendingActions) {
      try {
        await syncAction(action)
        await removePendingAction(action.id)
        console.log('✅ Synced action:', action.id)
      } catch (error) {
        console.error('❌ Failed to sync action:', action.id, error)
      }
    }
    
    console.log('✅ Background sync completed')
  } catch (error) {
    console.error('❌ Background sync failed:', error)
  }
}

// Get pending actions (implement based on your storage strategy)
async function getPendingActions() {
  // This would typically read from IndexedDB
  // For now, return empty array
  return []
}

// Sync individual action (implement based on your needs)
async function syncAction(action) {
  // This would typically make API calls
  console.log('Syncing action:', action)
  
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  return { success: true }
}

// Remove pending action (implement based on your storage strategy)
async function removePendingAction(actionId) {
  // This would typically remove from IndexedDB
  console.log('Removed pending action:', actionId)
}

// Message event for communication with main thread
self.addEventListener('message', (event) => {
  console.log('📨 Service Worker message:', event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Error event
self.addEventListener('error', (event) => {
  console.error('❌ Service Worker error:', event.error)
})

// Unhandled rejection event
self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Service Worker unhandled rejection:', event.reason)
})
