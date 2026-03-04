<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
    <div class="max-w-7xl mx-auto px-4 pt-24 pb-8 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div class="flex-1">
            <h1 class="text-2xl sm:text-3xl font-bold text-white mb-2">Talent Requests</h1>
            <p class="text-gray-400 text-sm sm:text-base">Manage your talent recruitment and collaboration opportunities</p>
          </div>
          <NuxtLink 
            to="/talent-request/create"
            class="w-full sm:w-auto px-4 sm:px-6 py-3 bg-teal-500 text-white rounded-xl hover:bg-teal-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Icon name="heroicons:plus" class="w-4 h-4 sm:w-5 sm:h-5" />
            <span class="hidden xs:inline">Create New Request</span>
            <span class="xs:hidden">Create</span>
          </NuxtLink>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 sm:p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-400 text-xs sm:text-sm">Total Requests</p>
                <p class="text-lg sm:text-2xl font-bold text-white">{{ talentRequestsStore.totalRequests }}</p>
              </div>
              <Icon name="heroicons:document-text" class="w-6 h-6 sm:w-8 sm:h-8 text-teal-400" />
            </div>
          </div>

          <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 sm:p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-400 text-xs sm:text-sm">Accepting Pilots</p>
                <p class="text-lg sm:text-2xl font-bold text-white">{{ talentRequestsStore.acceptingPilots.length }}</p>
              </div>
              <Icon name="heroicons:user-group" class="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
            </div>
          </div>

          <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 sm:p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-400 text-xs sm:text-sm">Casting Closed</p>
                <p class="text-lg sm:text-2xl font-bold text-white">{{ talentRequestsStore.castingClosed.length }}</p>
              </div>
              <Icon name="heroicons:lock-closed" class="w-6 h-6 sm:w-8 sm:h-8 text-red-400" />
            </div>
          </div>

          <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 sm:p-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-gray-400 text-xs sm:text-sm">Scheduled</p>
                <p class="text-lg sm:text-2xl font-bold text-white">{{ talentRequestsStore.scheduled.length }}</p>
              </div>
              <Icon name="heroicons:calendar" class="w-6 h-6 sm:w-8 sm:h-8 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      <!-- Filters and Search -->
      <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6 mb-8">
        <div class="flex flex-col gap-4">
          <!-- Search -->
          <div class="w-full">
            <label class="block text-gray-300 mb-2 font-medium text-sm sm:text-base">Search Requests</label>
            <div class="relative">
              <Icon name="heroicons:magnifying-glass" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search by project title, casting needs..."
                class="w-full pl-10 pr-4 py-2 sm:py-3 bg-black/20 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none text-sm sm:text-base"
              />
            </div>
          </div>

          <!-- Filters Row -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Status Filter -->
            <div>
              <label class="block text-gray-300 mb-2 font-medium text-sm sm:text-base">Status</label>
              <select
                v-model="statusFilter"
                class="w-full px-3 sm:px-4 py-2 sm:py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none text-sm sm:text-base"
              >
                <option value="">All Status</option>
                <option value="accepting_pilots">Accepting Pilots</option>
                <option value="casting_closed">Casting Closed</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            <!-- Sort -->
            <div>
              <label class="block text-gray-300 mb-2 font-medium text-sm sm:text-base">Sort By</label>
              <select
                v-model="sortBy"
                class="w-full px-3 sm:px-4 py-2 sm:py-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-teal-500 focus:outline-none text-sm sm:text-base"
              >
                <option value="createdAt">Date Created</option>
                <option value="projectTitle">Project Title</option>
                <option value="startDate">Start Date</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="talentRequestsStore.isLoading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400 mb-4"></div>
        <p class="text-gray-300">Loading talent requests...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="talentRequestsStore.error" class="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 class="text-red-200 text-lg mb-2">Error Loading Requests</h3>
        <p class="text-red-200 mb-4">{{ talentRequestsStore.error }}</p>
        <button @click="refreshRequests" class="px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors">
          Try Again
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredRequests.length === 0" class="text-center py-12">
        <Icon name="heroicons:user-group" class="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 class="text-white text-xl mb-2">No talent requests found</h3>
        <p class="text-gray-300 mb-6">{{ searchQuery || statusFilter ? 'Try adjusting your search or filters' : 'Create your first talent request to get started' }}</p>
        <NuxtLink to="/talent-request/create" class="inline-flex items-center px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors">
          <Icon name="heroicons:plus" class="w-4 h-4 mr-2" />
          Create First Request
        </NuxtLink>
      </div>

      <!-- Requests List -->
      <div v-else class="space-y-4">
        <div 
          v-for="request in filteredRequests" 
          :key="request.id"
          class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6 hover:border-teal-500/30 transition-all duration-300"
        >
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div class="flex-1">
              <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                <h3 class="text-lg sm:text-xl font-semibold text-white">{{ request.projectTitle }}</h3>
                <div :class="getStatusBadgeClass(request.status)" class="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium w-fit">
                  {{ getStatusText(request.status) }}
                </div>
              </div>
              <p class="text-gray-400 mb-2 text-sm sm:text-base">{{ request.castingNeeds }}</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                <span class="flex items-center gap-1">
                  <Icon name="heroicons:calendar" class="w-3 h-3 sm:w-4 sm:h-4" />
                  {{ formatDate(request.startDate) }}
                </span>
                <span class="flex items-center gap-1">
                  <Icon name="heroicons:clock" class="w-3 h-3 sm:w-4 sm:h-4" />
                  {{ request.timeSlots.length }} time slots
                </span>
                <span class="flex items-center gap-1">
                  <Icon name="heroicons:map-pin" class="w-3 h-3 sm:w-4 sm:h-4" />
                  {{ request.location }}
                </span>
                <span v-if="request.applications && request.applications.length > 0" class="flex items-center gap-1">
                  <Icon name="heroicons:user" class="w-3 h-3 sm:w-4 sm:h-4" />
                  {{ request.applications.length }} applications
                </span>
              </div>
            </div>
            
            <div class="flex items-center gap-2 sm:flex-shrink-0">
              <NuxtLink 
                :to="`/talent-requests/${request.id}/view`"
                class="px-2 sm:px-3 py-2 text-teal-400 hover:text-teal-300 text-xs sm:text-sm border border-teal-500/30 rounded-lg hover:bg-teal-500/10 transition-colors"
              >
                View
              </NuxtLink>
              <button 
                @click="showRequestMenu(request)"
                class="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Icon name="heroicons:ellipsis-vertical" class="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          <!-- Tags -->
          <div v-if="request.tags && request.tags.length > 0" class="flex flex-wrap gap-2 mb-4">
            <span 
              v-for="tag in request.tags" 
              :key="tag"
              class="px-2 py-1 bg-white/10 text-white/80 rounded-full text-xs"
            >
              {{ tag }}
            </span>
          </div>

          <!-- Quick Actions -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10">
            <div class="flex flex-wrap items-center gap-3">
              <button 
                @click="copyShareLink(request)"
                class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm"
              >
                <Icon name="heroicons:link" class="w-3 h-3 sm:w-4 sm:h-4" />
                Copy Link
              </button>
              <button 
                @click="toggleRequestStatus(request)"
                class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm"
              >
                <Icon name="heroicons:pencil" class="w-3 h-3 sm:w-4 sm:h-4" />
                {{ request.status === 'accepting_pilots' ? 'Close Casting' : 'Reopen Casting' }}
              </button>
            </div>
            
            <div class="text-xs sm:text-sm text-gray-500">
              Created {{ formatRelativeDate(request.createdAt) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Request Menu Modal -->
      <div v-if="showMenuModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-gray-900 border border-white/10 rounded-2xl max-w-sm w-full">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-white">Request Options</h3>
              <button @click="showMenuModal = false" class="text-gray-400 hover:text-white">
                <Icon name="heroicons:x-mark" class="w-5 h-5" />
              </button>
            </div>
            
            <div class="space-y-3">
              <button 
                @click="editRequest(selectedRequest)"
                class="w-full text-left px-4 py-3 text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-3"
              >
                <Icon name="heroicons:pencil" class="w-5 h-5 text-blue-400" />
                Edit Request
              </button>
              <button 
                @click="duplicateRequest(selectedRequest)"
                class="w-full text-left px-4 py-3 text-white hover:bg-white/10 rounded-lg transition-colors flex items-center gap-3"
              >
                <Icon name="heroicons:document-duplicate" class="w-5 h-5 text-green-400" />
                Duplicate Request
              </button>
              <button 
                @click="deleteRequest(selectedRequest.id)"
                class="w-full text-left px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-3"
              >
                <Icon name="heroicons:trash" class="w-5 h-5" />
                Delete Request
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Share Link Modal -->
      <div v-if="showShareModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-white">Share Talent Request</h3>
              <button @click="showShareModal = false" class="text-gray-400 hover:text-white">
                <Icon name="heroicons:x-mark" class="w-5 h-5" />
              </button>
            </div>
            
            <div class="space-y-4">
              <p class="text-gray-300 text-sm">Share this link with potential talent:</p>
              <div class="bg-black/20 rounded-lg p-4 border border-teal-500/30">
                <p class="text-gray-300 text-sm mb-2">Share Link:</p>
                <div class="flex items-center gap-2">
                  <input
                    :value="shareableLink"
                    readonly
                    class="flex-1 bg-black/20 border border-teal-500/30 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <button
                    @click="copyShareLinkToClipboard"
                    class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                           rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                    :class="{ 'bg-green-500/20 text-green-300 border-green-500/30': linkCopied }"
                  >
                    <Icon 
                      :name="linkCopied ? 'heroicons:check' : 'heroicons:clipboard'" 
                      class="w-4 h-4" 
                    />
                  </button>
                </div>
              </div>
              
              <div class="flex gap-2">
                <button
                  @click="generateNewLink"
                  class="flex-1 px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                         rounded-lg hover:bg-teal-500/30 transition-all duration-300"
                >
                  Generate New Link
                </button>
                <button
                  @click="clearShareLink"
                  class="px-4 py-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 
                         rounded-lg hover:bg-gray-500/30 transition-all duration-300"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useTalentRequestsStore } from '@/stores/talentRequests'
import { useAuthStore } from '@/stores/auth'

// Page metadata
useHead({
  title: 'Talent Requests - Twilly',
  meta: [
    { name: 'description', content: 'Manage your talent recruitment and collaboration opportunities on Twilly' }
  ]
})

// Store and auth
const talentRequestsStore = useTalentRequestsStore()
const authStore = useAuthStore()

// Reactive state
const searchQuery = ref('')
const statusFilter = ref('')
const sortBy = ref('createdAt')
const showMenuModal = ref(false)
const selectedRequest = ref(null)
const showShareModal = ref(false)
const shareableLink = ref('')
const linkCopied = ref(false)

// Computed properties
const filteredRequests = computed(() => {
  let requests = talentRequestsStore.requests || []
  
  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    requests = requests.filter(request => 
      request.projectTitle?.toLowerCase().includes(query) ||
      request.castingNeeds?.toLowerCase().includes(query) ||
      request.location?.toLowerCase().includes(query)
    )
  }
  
  // Apply status filter
  if (statusFilter.value) {
    requests = requests.filter(request => request.status === statusFilter.value)
  }
  
  // Apply sorting
  requests.sort((a, b) => {
    switch (sortBy.value) {
      case 'projectTitle':
        return (a.projectTitle || '').localeCompare(b.projectTitle || '')
      case 'startDate':
        return new Date(a.startDate) - new Date(b.startDate)
      case 'status':
        return (a.status || '').localeCompare(b.status || '')
      case 'createdAt':
      default:
        return new Date(b.createdAt) - new Date(a.createdAt)
    }
  })
  
  return requests
})

// Methods
const refreshRequests = async () => {
  if (authStore.user?.attributes?.email) {
    await talentRequestsStore.loadUserRequests(authStore.user.attributes.email)
  }
}

const showRequestMenu = (request) => {
  selectedRequest.value = request
  showMenuModal.value = true
}

const editRequest = (request) => {
  showMenuModal.value = false
  navigateTo(`/talent-requests/${request.id}/edit`)
}

const duplicateRequest = (request) => {
  showMenuModal.value = false
  // TODO: Implement duplication logic
  console.log('Duplicate request:', request)
}

const deleteRequest = async (requestId) => {
  if (confirm('Are you sure you want to delete this talent request? This action cannot be undone.')) {
    try {
      const result = await talentRequestsStore.deleteRequest(requestId)
      if (result.success) {
        showMenuModal.value = false
        await refreshRequests()
      }
    } catch (error) {
      console.error('Error deleting request:', error)
    }
  }
}



const toggleRequestStatus = async (request) => {
  const newStatus = request.status === 'accepting_pilots' ? 'casting_closed' : 'accepting_pilots'
  try {
    const result = await talentRequestsStore.updateRequestStatus(request.id, newStatus)
    if (result.success) {
      await refreshRequests()
    }
  } catch (error) {
    console.error('Error updating request status:', error)
  }
}

// Share link functions - EXACT SAME LOGIC AS MANAGEFILES.VUE
const copyShareLink = async (request) => {
  if (!authStore.user?.attributes?.email) {
    console.error('No user email available')
    return
  }

  // Check if user has a username set
  const hasUsername = authStore.user?.attributes?.username
  if (!hasUsername) {
    alert('Please set a username in your account settings to generate share links.')
    return
  }

  try {
    // Always use production domain for share previews
    const baseShareDomain = 'https://twilly.app'
    const userId = authStore.user.attributes.email
    const seriesName = request.channel || 'default'
    
    // Build CLEAN URL for sharing: /:username/:channelSlug (no params)
    const channelSlug = slugify(seriesName)
    const cleanUrl = `${baseShareDomain}/${encodeURIComponent(hasUsername)}/${encodeURIComponent(channelSlug)}?rid=${request.id}&title=${encodeURIComponent(request.projectTitle)}&description=${encodeURIComponent(request.castingNeeds)}`

    console.log('Creating CLEAN share URL (username + slug):', cleanUrl)
    shareableLink.value = cleanUrl
    showShareModal.value = true
  } catch (error) {
    console.error('Error generating share link:', error)
    alert('Error: ' + (error.message || 'Failed to generate share link'))
  }
}

const copyShareLinkToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(shareableLink.value)
    linkCopied.value = true
    setTimeout(() => {
      linkCopied.value = false
    }, 2000)
  } catch (error) {
    console.error('Error copying link:', error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = shareableLink.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    linkCopied.value = true
    setTimeout(() => {
      linkCopied.value = false
    }, 2000)
  }
}

const generateNewLink = () => {
  shareableLink.value = ''
  // Regenerate link for the current request
  if (selectedRequest.value) {
    copyShareLink(selectedRequest.value)
  }
}

const clearShareLink = () => {
  shareableLink.value = ''
  showShareModal.value = false
}

// Utility functions
const getStatusBadgeClass = (status) => {
  const classes = {
    'accepting_pilots': 'bg-green-500/20 text-green-400 border border-green-500/30',
    'casting_closed': 'bg-red-500/20 text-red-400 border border-red-500/30',
    'scheduled': 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
  }
  return classes[status] || 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
}

const getStatusText = (status) => {
  const texts = {
    'accepting_pilots': 'Accepting Pilots',
    'casting_closed': 'Casting Closed',
    'scheduled': 'Scheduled'
  }
  return texts[status] || status
}

const formatDate = (date) => {
  if (!date) return 'TBD'
  return new Date(date).toLocaleDateString()
}

const formatRelativeDate = (date) => {
  if (!date) return 'Unknown'
  const now = new Date()
  const requestDate = new Date(date)
  const diffTime = Math.abs(now - requestDate)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`
  return `${Math.ceil(diffDays / 365)} years ago`
}

const slugify = (text) => {
  if (!text) return 'default'
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

// Load data on mount
onMounted(async () => {
  if (authStore.user?.attributes?.email) {
    await talentRequestsStore.loadUserRequests(authStore.user.attributes.email)
  }
})
</script>

<style scoped>
/* Mobile-first responsive design */
@media (max-width: 640px) {
  .xs\:inline {
    display: inline;
  }
  
  .xs\:hidden {
    display: none;
  }
}

@media (min-width: 641px) {
  .xs\:inline {
    display: inline;
  }
  
  .xs\:hidden {
    display: none;
  }
}
</style>
