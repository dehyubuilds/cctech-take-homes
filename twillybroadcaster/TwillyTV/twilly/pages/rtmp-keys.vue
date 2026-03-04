<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] pt-16">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl sm:text-4xl font-bold text-white mb-2">
              RTMP <span class="text-teal-400">Key Management</span>
            </h1>
            <p class="text-gray-400 text-sm sm:text-base">
              Manage your stream keys and track collaborators
            </p>
          </div>
          <div class="hidden sm:block">
            <div class="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center">
              <Icon name="heroicons:key" class="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center items-center h-64">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mb-4"></div>
          <p class="text-gray-400">Loading RTMP keys...</p>
        </div>
      </div>

      <!-- Content -->
      <div v-else class="space-y-6">
        <!-- Channel Selection -->
        <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Icon name="heroicons:folder" class="w-5 h-5 text-teal-400" />
            Select Channel
          </h3>
          
          <div class="flex items-center gap-3">
            <select
              v-model="selectedChannel"
              class="flex-1 rounded-lg border border-teal-500/30 bg-black/20 p-3 text-white outline-teal-500"
              @change="loadChannelKeys"
            >
              <option value="">Select a channel...</option>
              <option v-for="channel in channels" :key="channel.name" :value="channel.name">
                {{ channel.name }}
              </option>
            </select>
            
            <button
              v-if="selectedChannel"
              @click="generateNewKey"
              :disabled="isGeneratingKey"
              class="px-4 py-3 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300 flex items-center gap-2 disabled:opacity-50"
            >
              <Icon 
                v-if="isGeneratingKey" 
                name="heroicons:arrow-path" 
                class="w-5 h-5 animate-spin" 
              />
              <Icon v-else name="heroicons:plus" class="w-5 h-5" />
              {{ isGeneratingKey ? 'Generating...' : 'Generate Key' }}
            </button>
          </div>
        </div>

        <!-- Keys Display -->
        <div v-if="selectedChannel && channelKeys.length > 0" class="space-y-4">
          <div v-for="key in channelKeys" :key="key.streamKey" class="bg-black/30 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
            <!-- Key Header -->
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center">
                  <Icon name="heroicons:key" class="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h4 class="text-white font-semibold">
                    {{ key.isGuestKey ? 'Guest Key' : `Key #${key.keyNumber}` }}
                  </h4>
                  <p class="text-gray-400 text-sm">
                    {{ key.isGuestKey ? `Channel: ${key.guestChannelId}` : `Created ${formatDate(key.createdAt)}` }}
                  </p>
                  <p v-if="key.isGuestKey" class="text-blue-400 text-xs">
                    Guest access to {{ key.guestChannelId }}
                  </p>
                </div>
              </div>
              
              <div class="flex items-center gap-2">
                <span v-if="key.isGuestKey" class="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                  Guest Key
                </span>
                <span v-else class="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                  {{ key.isActive ? 'Active' : 'Inactive' }}
                </span>
                <button
                  v-if="!key.isGuestKey"
                  @click="toggleKeyStatus(key.streamKey, !key.isActive)"
                  class="p-2 text-gray-400 hover:text-white transition-colors"
                  :title="key.isActive ? 'Deactivate' : 'Activate'"
                >
                  <Icon :name="key.isActive ? 'heroicons:pause' : 'heroicons:play'" class="w-4 h-4" />
                </button>
                <button
                  @click="deleteKey(key.streamKey)"
                  class="p-2 text-red-400 hover:text-red-300 transition-colors"
                  :title="key.isGuestKey ? 'Remove Guest Access' : 'Delete Key'"
                >
                  <Icon name="heroicons:trash" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Stream Key -->
            <div class="mb-4">
              <label class="block text-gray-300 text-sm mb-2">Complete RTMP URL:</label>
              <div class="flex items-center gap-2">
                <input
                  :value="`${RTMP_SERVER_URL}/${key.streamKey}`"
                  readonly
                  class="flex-1 bg-black/20 border border-teal-500/30 rounded-lg px-3 py-2 text-white text-sm font-mono"
                />
                <button
                  @click="copyToClipboard(`${RTMP_SERVER_URL}/${key.streamKey}`)"
                  class="px-3 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                >
                  <Icon name="heroicons:clipboard" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Collaborators -->
            <div v-if="!key.isGuestKey" class="mb-4">
              <label class="block text-gray-300 text-sm mb-2">Shared with:</label>
              <div v-if="key.collaborators && key.collaborators.length > 0" class="space-y-2">
                <div v-for="collab in key.collaborators" :key="collab.email" class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <Icon name="heroicons:user" class="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p class="text-white text-sm">{{ collab.email }}</p>
                      <p class="text-gray-400 text-xs">Added {{ formatDate(collab.addedAt) }}</p>
                    </div>
                  </div>
                  <button
                    @click="removeCollaborator(key.streamKey, collab.email)"
                    class="p-1 text-red-400 hover:text-red-300 transition-colors"
                    title="Remove Collaborator"
                  >
                    <Icon name="heroicons:x-mark" class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div v-else class="text-gray-400 text-sm italic">No collaborators yet</div>
            </div>

            <!-- Add Collaborator -->
            <div v-if="!key.isGuestKey" class="border-t border-teal-500/20 pt-4">
              <h5 class="text-white text-sm font-medium mb-2">Add Collaborator:</h5>
              <div class="flex items-center gap-2">
                <input
                  v-model="newCollaboratorEmail"
                  type="email"
                  placeholder="Enter collaborator email"
                  class="flex-1 bg-black/20 border border-teal-500/30 rounded-lg px-3 py-2 text-white text-sm"
                />
                <button
                  @click="addCollaborator(key.streamKey)"
                  :disabled="!newCollaboratorEmail || isAddingCollaborator"
                  class="px-4 py-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all duration-300 disabled:opacity-50"
                >
                  <Icon v-if="isAddingCollaborator" name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                  <Icon v-else name="heroicons:user-plus" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <!-- Usage Stats -->
            <div class="mt-4 pt-4 border-t border-teal-500/20">
              <h5 class="text-white text-sm font-medium mb-2">Usage Stats:</h5>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p class="text-gray-400">Total Streams:</p>
                  <p class="text-white font-semibold">{{ key.usageStats?.totalStreams || 0 }}</p>
                </div>
                <div>
                  <p class="text-gray-400">Last Used:</p>
                  <p class="text-white font-semibold">{{ key.usageStats?.lastUsed ? formatDate(key.usageStats.lastUsed) : 'Never' }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Keys Message -->
        <div v-else-if="selectedChannel" class="text-center py-12 text-gray-400">
          <Icon name="heroicons:key" class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p class="text-lg mb-2">No RTMP keys generated yet</p>
          <p class="text-sm">Generate your first key to start sharing with collaborators</p>
        </div>

        <!-- No Channel Selected -->
        <div v-else class="text-center py-12 text-gray-400">
          <Icon name="heroicons:folder" class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p class="text-lg mb-2">Select a channel first</p>
          <p class="text-sm">Choose a channel to manage its RTMP keys</p>
        </div>

        <!-- Server Info -->
        <div v-if="selectedChannel" class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h4 class="text-blue-300 font-medium mb-2">Streaming Server Info:</h4>
          <div class="text-sm text-gray-300 space-y-1">
            <p><strong>Complete RTMP URL:</strong> [Use any URL from above]</p>
            <p class="text-xs text-gray-400 mt-2">
              Copy the complete RTMP URL and paste it directly into your streaming software. Share different URLs with different collaborators. All streams will appear in your channel.
            </p>
          </div>
        </div>
      </div>

      <!-- Success/Error Notifications -->
      <div
        v-if="showNotification"
        class="fixed bottom-4 left-1/2 transform -translate-x-1/2 backdrop-blur-sm
               text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2
               border z-50"
        :class="[
          notificationType === 'error'
            ? 'bg-red-500/90 border-red-400/30'
            : 'bg-green-500/90 border-green-400/30'
        ]"
      >
        <Icon 
          :name="notificationType === 'error' ? 'heroicons:x-circle' : 'heroicons:check-circle'" 
          class="w-5 h-5" 
        />
        {{ notificationMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useFileStore } from '~/stores/useFileStore'

// Store setup
const authStore = useAuthStore()
const fileStore = useFileStore()

// RTMP Server URL
const RTMP_SERVER_URL = 'rtmp://100.24.103.57:1935/live'

// Reactive data
const isLoading = ref(true)
const selectedChannel = ref('')
const channelKeys = ref([])
const channels = ref([])
const isGeneratingKey = ref(false)
const isAddingCollaborator = ref(false)
const newCollaboratorEmail = ref('')
const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

// Computed
const hasUser = computed(() => authStore.user?.attributes?.email)

// Methods
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const showSuccess = (message) => {
  notificationMessage.value = message
  notificationType.value = 'success'
  showNotification.value = true
  setTimeout(() => { showNotification.value = false }, 3000)
}

const showError = (message) => {
  notificationMessage.value = message
  notificationType.value = 'error'
  showNotification.value = true
  setTimeout(() => { showNotification.value = false }, 3000)
}

const loadChannels = async () => {
  try {
    // Load channels from file store
    await fileStore.loadFolders()
    channels.value = fileStore.folders || []
  } catch (error) {
    console.error('Error loading channels:', error)
    showError('Failed to load channels')
  }
}

const loadChannelKeys = async () => {
  if (!selectedChannel.value) return
  
  try {
    isLoading.value = true
    const response = await $fetch('/api/stream-keys/get', {
      method: 'POST',
      body: {
        channelName: selectedChannel.value,
        userEmail: authStore.user.attributes.email
      }
    })
    
    if (response.success) {
      channelKeys.value = response.streamKeys || []
    } else {
      channelKeys.value = []
      showError(response.message || 'Failed to load keys')
    }
  } catch (error) {
    console.error('Error loading channel keys:', error)
    channelKeys.value = []
    showError('Failed to load keys')
  } finally {
    isLoading.value = false
  }
}

const generateNewKey = async () => {
  if (!selectedChannel.value) return
  
  try {
    isGeneratingKey.value = true
    const response = await $fetch('/api/stream-keys/generate', {
      method: 'POST',
      body: {
        channelName: selectedChannel.value,
        userEmail: authStore.user.attributes.email
      }
    })
    
    if (response.success) {
      showSuccess('New RTMP key generated!')
      await loadChannelKeys()
    } else {
      showError(response.message || 'Failed to generate key')
    }
  } catch (error) {
    console.error('Error generating key:', error)
    showError('Failed to generate key')
  } finally {
    isGeneratingKey.value = false
  }
}

const toggleKeyStatus = async (streamKey, isActive) => {
  try {
    const response = await $fetch('/api/stream-keys/toggle', {
      method: 'POST',
      body: {
        streamKey,
        isActive,
        userEmail: authStore.user.attributes.email
      }
    })
    
    if (response.success) {
      showSuccess(`Key ${isActive ? 'activated' : 'deactivated'}!`)
      await loadChannelKeys()
    } else {
      showError(response.message || 'Failed to update key status')
    }
  } catch (error) {
    console.error('Error toggling key status:', error)
    showError('Failed to update key status')
  }
}

const deleteKey = async (streamKey) => {
  if (!confirm('Are you sure you want to delete this key? This action cannot be undone.')) return
  
  try {
    const response = await $fetch('/api/stream-keys/delete', {
      method: 'POST',
      body: {
        streamKey,
        userEmail: authStore.user.attributes.email
      }
    })
    
    if (response.success) {
      showSuccess('Key deleted successfully!')
      await loadChannelKeys()
    } else {
      showError(response.message || 'Failed to delete key')
    }
  } catch (error) {
    console.error('Error deleting key:', error)
    showError('Failed to delete key')
  }
}

const addCollaborator = async (streamKey) => {
  if (!newCollaboratorEmail.value) return
  
  try {
    isAddingCollaborator.value = true
    const response = await $fetch('/api/stream-keys/add-collaborator', {
      method: 'POST',
      body: {
        streamKey,
        collaboratorEmail: newCollaboratorEmail.value,
        userEmail: authStore.user.attributes.email
      }
    })
    
    if (response.success) {
      showSuccess('Collaborator added successfully!')
      newCollaboratorEmail.value = ''
      await loadChannelKeys()
    } else {
      showError(response.message || 'Failed to add collaborator')
    }
  } catch (error) {
    console.error('Error adding collaborator:', error)
    showError('Failed to add collaborator')
  } finally {
    isAddingCollaborator.value = false
  }
}

const removeCollaborator = async (streamKey, collaboratorEmail) => {
  if (!confirm(`Remove ${collaboratorEmail} from this key?`)) return
  
  try {
    const response = await $fetch('/api/stream-keys/remove-collaborator', {
      method: 'POST',
      body: {
        streamKey,
        collaboratorEmail,
        userEmail: authStore.user.attributes.email
      }
    })
    
    if (response.success) {
      showSuccess('Collaborator removed successfully!')
      await loadChannelKeys()
    } else {
      showError(response.message || 'Failed to remove collaborator')
    }
  } catch (error) {
    console.error('Error removing collaborator:', error)
    showError('Failed to remove collaborator')
  }
}

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    showSuccess('Copied to clipboard!')
  } catch (error) {
    showError('Failed to copy to clipboard')
  }
}

// Lifecycle
onMounted(async () => {
  if (!hasUser.value) {
    showError('Please sign in to access RTMP key management')
    return
  }
  
  await loadChannels()
  isLoading.value = false
})
</script>

<style scoped>
/* Custom styles for the RTMP key management page */
.key-card {
  transition: all 0.3s ease;
}

.key-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

/* Smooth animations */
* {
  transition: all 0.2s ease;
}

/* Button hover effects */
button:not(:disabled):hover {
  transform: translateY(-1px);
}

/* Input focus effects */
input:focus {
  transform: scale(1.02);
}
</style> 