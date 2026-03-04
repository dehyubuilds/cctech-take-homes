export default defineNuxtPlugin(() => {
  if (process.client) {
    console.log('🔧 PWA Debug Plugin: Initializing...')
    
    // PWA Status tracking
    const pwaStatus = {
      serviceWorker: false,
      manifest: false,
      installable: false,
      installed: false,
      offline: false,
      pushNotifications: false,
      errors: []
    }
    
    // Log PWA requirements check
    const checkPWARequirements = () => {
      console.log('🔧 PWA Debug: Checking requirements...')
      
      // Check HTTPS
      const isHTTPS = window.location.protocol === 'https:'
      console.log('🔧 PWA Debug: HTTPS:', isHTTPS ? '✅' : '❌')
      
      // Check service worker support
      const hasServiceWorker = 'serviceWorker' in navigator
      console.log('🔧 PWA Debug: Service Worker Support:', hasServiceWorker ? '✅' : '❌')
      
      // Check push manager support
      const hasPushManager = 'PushManager' in window
      console.log('🔧 PWA Debug: Push Manager Support:', hasPushManager ? '✅' : '❌')
      
      // Check cache API support
      const hasCacheAPI = 'caches' in window
      console.log('🔧 PWA Debug: Cache API Support:', hasCacheAPI ? '✅' : '❌')
      
      // Check if running in standalone mode
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      console.log('🔧 PWA Debug: Standalone Mode:', isStandalone ? '✅' : '❌')
      
      // Check if running in fullscreen mode
      const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches
      console.log('🔧 PWA Debug: Fullscreen Mode:', isFullscreen ? '✅' : '❌')
      
      // Check user agent for mobile
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      console.log('🔧 PWA Debug: Mobile Device:', isMobile ? '✅' : '❌')
      
      // Check iOS Safari specifically
      const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent)
      console.log('🔧 PWA Debug: iOS Safari:', isIOSSafari ? '✅' : '❌')
      
      return {
        isHTTPS,
        hasServiceWorker,
        hasPushManager,
        hasCacheAPI,
        isStandalone,
        isFullscreen,
        isMobile,
        isIOSSafari
      }
    }
    
    // Check manifest loading
    const checkManifest = async () => {
      try {
        console.log('🔧 PWA Debug: Checking manifest...')
        
        const manifestLink = document.querySelector('link[rel="manifest"]')
        if (manifestLink) {
          console.log('🔧 PWA Debug: Manifest link found:', manifestLink.href)
          
          const response = await fetch(manifestLink.href)
          if (response.ok) {
            const manifest = await response.json()
            console.log('🔧 PWA Debug: Manifest loaded successfully:', manifest)
            pwaStatus.manifest = true
            
            // Check manifest requirements
            const hasName = !!manifest.name
            const hasShortName = !!manifest.short_name
            const hasStartUrl = !!manifest.start_url
            const hasDisplay = !!manifest.display
            const hasIcons = !!manifest.icons && manifest.icons.length > 0
            
            console.log('🔧 PWA Debug: Manifest requirements:')
            console.log('  - Name:', hasName ? '✅' : '❌')
            console.log('  - Short Name:', hasShortName ? '✅' : '❌')
            console.log('  - Start URL:', hasStartUrl ? '✅' : '❌')
            console.log('  - Display:', hasDisplay ? '✅' : '❌')
            console.log('  - Icons:', hasIcons ? '✅' : '❌')
            
            return manifest
          } else {
            console.error('❌ PWA Debug: Manifest fetch failed:', response.status)
            pwaStatus.errors.push('Manifest fetch failed')
          }
        } else {
          console.error('❌ PWA Debug: No manifest link found')
          pwaStatus.errors.push('No manifest link found')
        }
      } catch (error) {
        console.error('❌ PWA Debug: Manifest check failed:', error)
        pwaStatus.errors.push('Manifest check failed')
      }
      return null
    }
    
    // Check service worker registration
    const checkServiceWorker = async () => {
      try {
        console.log('🔧 PWA Debug: Checking service worker...')
        
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration) {
            console.log('🔧 PWA Debug: Service Worker registered:', registration)
            console.log('🔧 PWA Debug: Service Worker state:', registration.active ? 'Active' : 'Inactive')
            pwaStatus.serviceWorker = true
            
            // Check service worker script
            if (registration.active) {
              console.log('🔧 PWA Debug: Service Worker script:', registration.active.scriptURL)
            }
            
            return registration
          } else {
            console.log('🔧 PWA Debug: No service worker registration found')
            pwaStatus.errors.push('No service worker registration')
          }
        } else {
          console.log('🔧 PWA Debug: Service Worker not supported')
          pwaStatus.errors.push('Service Worker not supported')
        }
      } catch (error) {
        console.error('❌ PWA Debug: Service Worker check failed:', error)
        pwaStatus.errors.push('Service Worker check failed')
      }
      return null
    }
    
    // Check PWA installability
    const checkInstallability = () => {
      console.log('🔧 PWA Debug: Checking installability...')
      
      // Check if beforeinstallprompt event has fired (desktop browsers)
      if (window.deferredPrompt) {
        console.log('🔧 PWA Debug: Install prompt available ✅')
        pwaStatus.installable = true
      } else {
        console.log('🔧 PWA Debug: Install prompt not available ❌')
        
        // Check if this is a mobile device that can install via "Add to Home Screen"
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        
        if (isMobile && !isStandalone) {
          console.log('🔧 PWA Debug: Mobile device detected - can install via "Add to Home Screen" ✅')
          console.log('🔧 PWA Debug: iOS Safari:', isIOS ? '✅' : '❌')
          console.log('🔧 PWA Debug: Mobile install method: Share → Add to Home Screen')
          pwaStatus.installable = true
        } else {
          pwaStatus.installable = false
        }
      }
      
      // Check if app is already installed
      if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('🔧 PWA Debug: App already installed ✅')
        pwaStatus.installed = true
      } else {
        console.log('🔧 PWA Debug: App not installed ❌')
        pwaStatus.installed = false
      }
    }
    
    // Check offline capability
    const checkOfflineCapability = () => {
      console.log('🔧 PWA Debug: Checking offline capability...')
      
      if ('caches' in window) {
        console.log('🔧 PWA Debug: Cache API available ✅')
        pwaStatus.offline = true
      } else {
        console.log('🔧 PWA Debug: Cache API not available ❌')
        pwaStatus.offline = false
      }
    }
    
    // Check push notification capability
    const checkPushNotifications = async () => {
      console.log('🔧 PWA Debug: Checking push notifications...')
      
      if ('PushManager' in window) {
        console.log('🔧 PWA Debug: Push Manager available ✅')
        
        // Check permission
        if ('Notification' in window) {
          const permission = Notification.permission
          console.log('🔧 PWA Debug: Notification permission:', permission)
          pwaStatus.pushNotifications = permission === 'granted'
        }
      } else {
        console.log('🔧 PWA Debug: Push Manager not available ❌')
        pwaStatus.pushNotifications = false
      }
    }
    
    // Comprehensive PWA check
    const runPWACheck = async () => {
      console.log('🔧 PWA Debug: Running comprehensive PWA check...')
      console.log('🔧 PWA Debug: Current URL:', window.location.href)
      console.log('🔧 PWA Debug: User Agent:', navigator.userAgent)
      
      const requirements = checkPWARequirements()
      const manifest = await checkManifest()
      const swRegistration = await checkServiceWorker()
      
      checkInstallability()
      checkOfflineCapability()
      await checkPushNotifications()
      
      // Summary
      console.log('🔧 PWA Debug: === PWA STATUS SUMMARY ===')
      console.log('🔧 PWA Debug: HTTPS:', requirements.isHTTPS ? '✅' : '❌')
      console.log('🔧 PWA Debug: Service Worker:', pwaStatus.serviceWorker ? '✅' : '❌')
      console.log('🔧 PWA Debug: Manifest:', pwaStatus.manifest ? '✅' : '❌')
      console.log('🔧 PWA Debug: Installable:', pwaStatus.installable ? '✅' : '❌')
      console.log('🔧 PWA Debug: Installed:', pwaStatus.installed ? '✅' : '❌')
      console.log('🔧 PWA Debug: Offline:', pwaStatus.offline ? '✅' : '❌')
      console.log('🔧 PWA Debug: Push Notifications:', pwaStatus.pushNotifications ? '✅' : '❌')
      
      if (pwaStatus.errors.length > 0) {
        console.log('🔧 PWA Debug: Errors found:', pwaStatus.errors)
      }
      
      // PWA Score calculation
      let score = 0
      if (requirements.isHTTPS) score += 20
      if (pwaStatus.serviceWorker) score += 20
      if (pwaStatus.manifest) score += 20
      if (pwaStatus.offline) score += 20
      if (pwaStatus.pushNotifications) score += 20
      
      console.log('🔧 PWA Debug: PWA Score:', score + '/100')
      
      if (score >= 80) {
        console.log('🔧 PWA Debug: 🎉 PWA requirements met! App should be installable.')
      } else if (score >= 60) {
        console.log('🔧 PWA Debug: ⚠️ PWA partially working. Some features may not work.')
      } else {
        console.log('🔧 PWA Debug: ❌ PWA requirements not met. App will not be installable.')
      }
      
      return { pwaStatus, requirements, manifest, swRegistration, score }
    }
    
    // Listen for PWA events
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('🔧 PWA Debug: beforeinstallprompt event fired!')
      console.log('🔧 PWA Debug: Event details:', e)
      pwaStatus.installable = true
    })
    
    window.addEventListener('appinstalled', (e) => {
      console.log('🔧 PWA Debug: appinstalled event fired!')
      console.log('🔧 PWA Debug: Event details:', e)
      pwaStatus.installed = true
    })
    
    // Listen for service worker events
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        console.log('🔧 PWA Debug: Service Worker message:', e.data)
      })
      
      navigator.serviceWorker.addEventListener('error', (e) => {
        console.error('🔧 PWA Debug: Service Worker error:', e)
        pwaStatus.errors.push('Service Worker error')
      })
    }
    
    // Run initial check after a short delay
    setTimeout(() => {
      runPWACheck()
    }, 1000)
    
    // Run check again after page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        runPWACheck()
      }, 2000)
    })
    
    // Expose PWA debug functions globally
    window.pwaDebug = {
      runCheck: runPWACheck,
      getStatus: () => pwaStatus,
      checkRequirements: checkPWARequirements,
      checkManifest,
      checkServiceWorker,
      checkInstallability,
      checkOfflineCapability,
      checkPushNotifications
    }
    
    console.log('🔧 PWA Debug Plugin: Ready! Use window.pwaDebug.runCheck() to test PWA status')
  }
})
