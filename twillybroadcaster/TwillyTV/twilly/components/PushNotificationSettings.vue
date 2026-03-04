<template>
  <div class="push-notification-settings">
    <!-- Header -->
    <div class="mb-6">
      <h3 class="text-lg font-semibold text-white mb-2">Push Notifications</h3>
      <p class="text-gray-400 text-sm">Stay updated with new content and live streams</p>
    </div>
    
    <!-- Notification Status -->
    <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-4 mb-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center">
            <Icon name="heroicons:bell" class="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h4 class="text-white font-medium">Notification Status</h4>
            <p class="text-gray-400 text-sm">
              {{ notificationStatus }}
            </p>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <div 
            class="w-3 h-3 rounded-full"
            :class="notificationStatus === 'Enabled' ? 'bg-green-500' : 'bg-red-500'"
          ></div>
        </div>
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div class="space-y-3">
      <button
        v-if="!isSubscribed"
        @click="enableNotifications"
        :disabled="isLoading"
        class="w-full px-4 py-3 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95"
      >
        <div v-if="isLoading" class="flex items-center justify-center gap-2">
          <Icon name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
          <span>Enabling...</span>
        </div>
        <div v-else class="flex items-center justify-center gap-2">
          <Icon name="heroicons:bell" class="w-5 h-5" />
          <span>Enable Notifications</span>
        </div>
      </button>
      
      <button
        v-else
        @click="disableNotifications"
        :disabled="isLoading"
        class="w-full px-4 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95"
      >
        <div v-if="isLoading" class="flex items-center justify-center gap-2">
          <Icon name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
          <span>Disabling...</span>
        </div>
        <div v-else class="flex items-center justify-center gap-2">
          <Icon name="heroicons:bell-slash" class="w-5 h-5" />
          <span>Disable Notifications</span>
        </div>
      </button>
      
      <button
        v-if="isSubscribed"
        @click="testNotification"
        :disabled="isLoading"
        class="w-full px-4 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 active:scale-95"
      >
        <Icon name="heroicons:megaphone" class="w-5 h-5 inline mr-2" />
        Test Notification
      </button>
    </div>
    
    <!-- Notification Types -->
    <div v-if="isSubscribed" class="mt-6">
      <h4 class="text-white font-medium mb-3">Notification Types</h4>
      <div class="space-y-3">
        <label class="flex items-center gap-3 cursor-pointer">
          <input
            v-model="notificationTypes.newContent"
            type="checkbox"
            class="w-4 h-4 text-teal-500 bg-gray-700 border-gray-600 rounded focus:ring-teal-500 focus:ring-2"
          />
          <span class="text-gray-300 text-sm">New content and episodes</span>
        </label>
        
        <label class="flex items-center gap-3 cursor-pointer">
          <input
            v-model="notificationTypes.liveStreams"
            type="checkbox"
            class="w-4 h-4 text-teal-500 bg-gray-700 border-gray-600 rounded focus:ring-teal-500 focus:ring-2"
          />
          <span class="text-gray-300 text-sm">Live stream notifications</span>
        </label>
        
        <label class="flex items-center gap-3 cursor-pointer">
          <input
            v-model="notificationTypes.updates"
            type="checkbox"
            class="w-4 h-4 text-teal-500 bg-gray-700 border-gray-600 rounded focus:ring-teal-500 focus:ring-2"
          />
          <span class="text-gray-300 text-sm">App updates and announcements</span>
        </label>
      </div>
    </div>
    
    <!-- Help Text -->
    <div class="mt-6 p-4 bg-black/20 rounded-lg border border-gray-700">
      <div class="flex items-start gap-3">
        <Icon name="heroicons:information-circle" class="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div class="text-sm text-gray-400">
          <p class="mb-2">Push notifications help you stay connected with Twilly content even when the app is closed.</p>
          <p>You can manage notification permissions in your device settings at any time.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const { $pushNotifications } = useNuxtApp()

const isLoading = ref(false)
const isSubscribed = ref(false)
const notificationTypes = ref({
  newContent: true,
  liveStreams: true,
  updates: true
})

// Computed notification status
const notificationStatus = computed(() => {
  if (isLoading.value) return 'Loading...'
  return isSubscribed.value ? 'Enabled' : 'Disabled'
})

// Enable notifications
const enableNotifications = async () => {
  try {
    isLoading.value = true
    const success = await $pushNotifications.subscribe()
    
    if (success) {
      isSubscribed.value = true
      showSuccessMessage('Notifications enabled successfully!')
    }
  } catch (error) {
    console.error('Failed to enable notifications:', error)
    showErrorMessage('Failed to enable notifications. Please check your browser settings.')
  } finally {
    isLoading.value = false
  }
}

// Disable notifications
const disableNotifications = async () => {
  try {
    isLoading.value = true
    const success = await $pushNotifications.unsubscribe()
    
    if (success) {
      isSubscribed.value = false
      showSuccessMessage('Notifications disabled successfully!')
    }
  } catch (error) {
    console.error('Failed to disable notifications:', error)
    showErrorMessage('Failed to disable notifications.')
  } finally {
    isLoading.value = false
  }
}

// Test notification
const testNotification = async () => {
  try {
    await $pushNotifications.sendTestNotification()
    showSuccessMessage('Test notification sent!')
  } catch (error) {
    console.error('Failed to send test notification:', error)
    showErrorMessage('Failed to send test notification.')
  }
}

// Show success message
const showSuccessMessage = (message) => {
  // You can implement a toast notification system here
  console.log('✅', message)
}

// Show error message
const showErrorMessage = (message) => {
  // You can implement a toast notification system here
  console.error('❌', message)
}

// Load notification types from localStorage
const loadNotificationTypes = () => {
  try {
    const saved = localStorage.getItem('twilly-notification-types')
    if (saved) {
      notificationTypes.value = { ...notificationTypes.value, ...JSON.parse(saved) }
    }
  } catch (error) {
    console.error('Error loading notification types:', error)
  }
}

// Save notification types to localStorage
const saveNotificationTypes = () => {
  try {
    localStorage.setItem('twilly-notification-types', JSON.stringify(notificationTypes.value))
  } catch (error) {
    console.error('Error saving notification types:', error)
  }
}

// Watch for changes in notification types
watch(notificationTypes, saveNotificationTypes, { deep: true })

onMounted(async () => {
  // Check subscription status
  isSubscribed.value = $pushNotifications.isSubscribed()
  
  // Load saved notification types
  loadNotificationTypes()
})
</script>

<style scoped>
.push-notification-settings {
  max-width: 500px;
}

/* Custom checkbox styling */
input[type="checkbox"]:checked {
  background-color: #14b8a6;
  border-color: #14b8a6;
}

/* Smooth transitions */
.transition-all {
  transition: all 0.3s ease;
}
</style>
