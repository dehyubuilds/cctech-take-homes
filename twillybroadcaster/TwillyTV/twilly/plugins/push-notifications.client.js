export default defineNuxtPlugin(() => {
  // Only run on client side
  if (process.client) {
    const { $pwa } = useNuxtApp()
    
    // Push notification state
    let swRegistration = null
    let isSubscribed = false
    
    // Initialize push notifications
    const initPushNotifications = async () => {
      try {
        // Check if service worker is supported
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          console.log('❌ Push notifications not supported')
          return false
        }
        
        // Get service worker registration
        swRegistration = await navigator.serviceWorker.ready
        console.log('✅ Service Worker ready')
        
        // Check subscription status
        isSubscribed = await checkSubscription()
        
        // Set up service worker message handling
        navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
        
        console.log('🚀 Push notifications initialized')
        return true
        
      } catch (error) {
        console.error('❌ Error initializing push notifications:', error)
        return false
      }
    }
    
    // Check if user is subscribed to push notifications
    const checkSubscription = async () => {
      try {
        const subscription = await swRegistration.pushManager.getSubscription()
        return !!subscription
      } catch (error) {
        console.error('Error checking subscription:', error)
        return false
      }
    }
    
    // Subscribe to push notifications
    const subscribeToNotifications = async () => {
      try {
        if (!swRegistration) {
          throw new Error('Service Worker not ready')
        }
        
        // Request notification permission
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          throw new Error('Notification permission denied')
        }
        
        // Get VAPID public key from runtime config
        const config = useRuntimeConfig()
        const vapidPublicKey = config.public.vapidPublicKey
        
        if (!vapidPublicKey) {
          throw new Error('VAPID public key not configured')
        }
        
        // Convert VAPID key to Uint8Array
        const vapidPublicKeyArray = urlBase64ToUint8Array(vapidPublicKey)
        
        // Subscribe to push manager
        const subscription = await swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKeyArray
        })
        
        // Send subscription to server
        await sendSubscriptionToServer(subscription)
        
        isSubscribed = true
        console.log('✅ Subscribed to push notifications')
        
        // Show success notification
        showNotification('Notifications Enabled', 'You\'ll now receive updates about new content and live streams!')
        
        return true
        
      } catch (error) {
        console.error('❌ Error subscribing to notifications:', error)
        showNotification('Notification Error', 'Failed to enable notifications. Please try again.', 'error')
        return false
      }
    }
    
    // Unsubscribe from push notifications
    const unsubscribeFromNotifications = async () => {
      try {
        if (!swRegistration) {
          throw new Error('Service Worker not ready')
        }
        
        const subscription = await swRegistration.pushManager.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
          
          // Notify server about unsubscription
          await removeSubscriptionFromServer(subscription)
          
          isSubscribed = false
          console.log('✅ Unsubscribed from push notifications')
          
          showNotification('Notifications Disabled', 'You won\'t receive push notifications anymore.')
          
          return true
        }
        
        return false
        
      } catch (error) {
        console.error('❌ Error unsubscribing from notifications:', error)
        return false
      }
    }
    
    // Send subscription to server
    const sendSubscriptionToServer = async (subscription) => {
      try {
        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            userId: getCurrentUserId() // Implement based on your auth system
          })
        })
        
        if (!response.ok) {
          throw new Error('Failed to send subscription to server')
        }
        
        console.log('✅ Subscription sent to server')
        
      } catch (error) {
        console.error('❌ Error sending subscription to server:', error)
        throw error
      }
    }
    
    // Remove subscription from server
    const removeSubscriptionFromServer = async (subscription) => {
      try {
        const response = await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            userId: getCurrentUserId()
          })
        })
        
        if (!response.ok) {
          throw new Error('Failed to remove subscription from server')
        }
        
        console.log('✅ Subscription removed from server')
        
      } catch (error) {
        console.error('❌ Error removing subscription from server:', error)
      }
    }
    
    // Get current user ID (implement based on your auth system)
    const getCurrentUserId = () => {
      // This should return the current user's ID from your auth store
      // For now, returning a placeholder
      return 'user-' + Date.now()
    }
    
    // Convert VAPID key from base64 to Uint8Array
    const urlBase64ToUint8Array = (base64String) => {
      const padding = '='.repeat((4 - base64String.length % 4) % 4)
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/')
      
      const rawData = window.atob(base64)
      const outputArray = new Uint8Array(rawData.length)
      
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
      }
      return outputArray
    }
    
    // Show local notification
    const showNotification = (title, body, type = 'info') => {
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        return
      }
      
      const icon = type === 'error' ? '/favicon-ico' : '/twillyicon.png'
      
      const notification = new Notification(title, {
        body,
        icon,
        badge: '/twillyicon.png',
        tag: 'twilly-notification',
        requireInteraction: false,
        silent: false
      })
      
      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close()
      }, 5000)
      
      // Handle click
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    }
    
    // Handle service worker messages
    const handleServiceWorkerMessage = (event) => {
      if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
        const { title, body, data } = event.data
        
        // Show notification
        showNotification(title, body)
        
        // Handle notification data (e.g., navigate to specific page)
        if (data && data.url) {
          // Navigate to URL when notification is clicked
          window.addEventListener('focus', () => {
            navigateTo(data.url)
          })
        }
      }
    }
    
    // Send test notification
    const sendTestNotification = () => {
      showNotification('Test Notification', 'This is a test notification from Twilly!')
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPushNotifications)
    } else {
      initPushNotifications()
    }
    
    // Provide push notification utilities to components
    return {
      provide: {
        pushNotifications: {
          isSubscribed: () => isSubscribed,
          subscribe: subscribeToNotifications,
          unsubscribe: unsubscribeFromNotifications,
          showNotification,
          sendTestNotification,
          init: initPushNotifications
        }
      }
    }
  }
})
