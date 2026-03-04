export default defineNuxtPlugin(() => {
  // Only run on client side
  if (process.client) {
    // Add PWA styles
    if (!document.getElementById('pwa-styles')) {
      const style = document.createElement('style')
      style.id = 'pwa-styles'
      style.textContent = `
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes slideIn {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        
        #pwa-install-instructions {
          animation: fadeIn 0.3s ease-out;
        }
      `
      document.head.appendChild(style)
    }
    
    let deferredPrompt = null
    let installButton = null
    
    // Register our custom service worker (skip in development)
    const registerServiceWorker = async () => {
      try {
        // Skip service worker registration in development to avoid conflicts
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.log('🔧 PWA: Development mode - unregistering any existing service workers')
          
          // Unregister any existing service workers in development
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations()
            for (const registration of registrations) {
              await registration.unregister()
              console.log('🔧 PWA: Unregistered service worker:', registration)
            }
          }
          return null
        }
        
        if ('serviceWorker' in navigator) {
          console.log('🔧 PWA: Registering custom service worker...')
          const registration = await navigator.serviceWorker.register('/sw.js')
          console.log('✅ PWA: Service worker registered successfully:', registration)
          return registration
        }
      } catch (error) {
        console.error('❌ PWA: Service worker registration failed:', error)
      }
    }
    
    // Handle beforeinstallprompt event (desktop browsers)
    const handleBeforeInstallPrompt = (e) => {
      console.log('📱 Desktop install prompt available')
      
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      
      // Stash the event so it can be triggered later
      deferredPrompt = e
      
      // Show install button if it exists
      showInstallButton()
      
      // Emit event for components
      window.dispatchEvent(new CustomEvent('twilly-install-available'))
    }
    
    // Register service worker on mount
    registerServiceWorker()
    

    
    // Handle app installed event
    const handleAppInstalled = () => {
      console.log('✅ App installed successfully')
      
      // Clear the deferredPrompt
      deferredPrompt = null
      
      // Hide install button
      hideInstallButton()
      
      // Show success message
      showInstallSuccess()
      
      // Emit event for components
      window.dispatchEvent(new CustomEvent('twilly-installed'))
      
      // Track installation in analytics
      trackAppInstall()
    }
    
    // Show install button (desktop)
    const showInstallButton = () => {
      // Create floating install button if it doesn't exist
      if (!installButton) {
        installButton = document.createElement('div')
        installButton.id = 'pwa-install-button'
        installButton.className = 'fixed bottom-4 right-4 bg-teal-500 text-white px-4 py-3 rounded-full shadow-lg z-50 cursor-pointer transform hover:scale-105 transition-all duration-300'
        installButton.innerHTML = `
          <div class="flex items-center gap-2">
            <Icon name="heroicons:arrow-down-tray" class="w-5 h-5" />
            <span class="text-sm font-medium">Install App</span>
          </div>
        `
        
        // Add click handler
        installButton.addEventListener('click', promptInstall)
        
        // Add to body
        document.body.appendChild(installButton)
      }
      
      // Show the button
      installButton.style.display = 'block'
      installButton.style.transform = 'translateY(0)'
    }
    

    

    
    // Show mobile install instructions
    const showMobileInstallInstructions = () => {
      const instructions = document.createElement('div')
      instructions.id = 'pwa-install-instructions'
      instructions.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4'
      instructions.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
          <div class="text-center mb-6">
            <div class="text-6xl mb-4">📱</div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Install Twilly App</h3>
            <p class="text-gray-600 mb-6">Get the full app experience on your home screen</p>
          </div>
          
          <div class="space-y-4 mb-8">
            <div class="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
              <div class="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
              <div class="flex-1">
                <div class="font-semibold text-gray-900">Tap the Share Button</div>
                <div class="text-sm text-gray-600">Look for the share icon in Safari's toolbar</div>
              </div>
              <div class="text-2xl">📤</div>
            </div>
            
            <div class="flex items-center gap-4 p-4 bg-green-50 rounded-xl">
              <div class="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
              <div class="flex-1">
                <div class="font-semibold text-gray-900">Add to Home Screen</div>
                <div class="text-sm text-gray-600">Scroll down and tap "Add to Home Screen"</div>
              </div>
              <div class="text-2xl">🏠</div>
            </div>
            
            <div class="flex items-center gap-4 p-4 bg-purple-50 rounded-xl">
              <div class="bg-purple-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
              <div class="flex-1">
                <div class="font-semibold text-gray-900">Confirm Installation</div>
                <div class="text-sm text-gray-600">Tap "Add" to install on your home screen</div>
              </div>
              <div class="text-2xl">✅</div>
            </div>
          </div>
          
          <div class="bg-gray-50 rounded-xl p-4 mb-6">
            <div class="text-center text-sm text-gray-600">
              <div class="font-semibold mb-1">💡 Pro Tip:</div>
              <div>After installation, Twilly will work just like a native app!</div>
            </div>
          </div>
          
          <button class="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105" onclick="this.parentElement.parentElement.remove()">
            Got it! Let me install
          </button>
        </div>
      `
      
      document.body.appendChild(instructions)
      
      // Close on background click
      instructions.addEventListener('click', (e) => {
        if (e.target === instructions) {
          instructions.remove()
        }
      })
      
      // Add keyboard support
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          instructions.remove()
        }
      })
    }
    
    // Hide install button
    const hideInstallButton = () => {
      if (installButton) {
        installButton.style.transform = 'translateY(100px)'
        setTimeout(() => {
          installButton.style.display = 'none'
        }, 300)
      }
    }
    
    // Prompt user to install app
    const promptInstall = async () => {
      if (!deferredPrompt) {
        console.log('❌ No install prompt available')
        return
      }
      
      try {
        // Show the install prompt
        deferredPrompt.prompt()
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice
        
        console.log(`User response to install prompt: ${outcome}`)
        
        if (outcome === 'accepted') {
          console.log('✅ User accepted the install prompt')
        } else {
          console.log('❌ User dismissed the install prompt')
        }
        
        // Clear the deferredPrompt
        deferredPrompt = null
        
        // Hide install button
        hideInstallButton()
        
      } catch (error) {
        console.error('❌ Error prompting install:', error)
      }
    }
    
    // Show install success message
    const showInstallSuccess = () => {
      // Create success toast
      const toast = document.createElement('div')
      toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50'
      toast.innerHTML = `
        <div class="flex items-center gap-2">
          <Icon name="heroicons:check-circle" class="w-5 h-5" />
          <span>App installed successfully! 🎉</span>
        </div>
      `
      
      // Add to body
      document.body.appendChild(toast)
      
      // Auto remove after 3 seconds
      setTimeout(() => {
        toast.style.opacity = '0'
        setTimeout(() => {
          document.body.removeChild(toast)
        }, 300)
      }, 3000)
    }
    
    // Track app installation
    const trackAppInstall = () => {
      // Send analytics event
      if (typeof gtag !== 'undefined') {
        gtag('event', 'app_install', {
          event_category: 'engagement',
          event_label: 'pwa_install'
        })
      }
      
      // Store in localStorage
      localStorage.setItem('twilly-installed', Date.now().toString())
    }
    
    // Check if app is installed
    const isAppInstalled = () => {
      // Check if running in standalone mode (installed)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        return true
      }
      
      // Check if running in fullscreen mode
      if (window.navigator.standalone === true) {
        return true
      }
      
      // Check if we have installation timestamp
      return !!localStorage.getItem('twilly-installed')
    }
    
    // Add app-like behavior (scroll-friendly)
    const addAppLikeBehavior = () => {
      // DISABLED: Touch event handlers that interfere with scrolling
      console.log('🔧 PWA: Touch event handlers disabled to fix scroll issues')
      
      // Only add status bar for standalone mode
      if (window.matchMedia('(display-mode: standalone)').matches) {
        const statusBar = document.createElement('div')
        statusBar.className = 'fixed top-0 left-0 right-0 h-6 bg-black z-50'
        statusBar.style.webkitAppRegion = 'drag'
        document.body.appendChild(statusBar)
      }
      
      /* COMMENTED OUT - These were causing scroll issues:
      
      // Prevent pull-to-refresh on mobile
      let startY = 0
      let currentY = 0
      
      document.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY
      }, { passive: false })
      
      document.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY
        
        // Prevent pull-to-refresh
        if (currentY > startY && window.scrollY === 0) {
          e.preventDefault()
        }
      }, { passive: false })
      
      // Add app-like navigation gestures
      let touchStartX = 0
      let touchStartY = 0
      
      document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX
        touchStartY = e.touches[0].clientY
      }, { passive: true })
      
      document.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX
        const touchEndY = e.changedTouches[0].clientY
        
        const deltaX = touchEndX - touchStartX
        const deltaY = e.touchEndY - touchStartY
        
        // Swipe right to go back (if on mobile)
        if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 50 && window.history.length > 1) {
          window.history.back()
        }
      }, { passive: true })
      
      */
    }
    

    
    // Initialize PWA features
    const initPWA = () => {
      // Listen for install prompt
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      
      // Listen for app installed
      window.addEventListener('appinstalled', handleAppInstalled)
      
      // Add app-like behavior
      addAppLikeBehavior()
      
      // Check if already installed
      if (isAppInstalled()) {
        console.log('✅ App already installed')
        hideInstallButton()
      }
      
      console.log('🚀 PWA features initialized')
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPWA)
    } else {
      initPWA()
    }
    
    // Provide PWA utilities to components
    return {
      provide: {
        pwa: {
          isInstalled: isAppInstalled,
          promptInstall,
          showInstallButton,
          hideInstallButton,
          isInstallAvailable: () => !!deferredPrompt
        }
      }
    }
  }
}) 