<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
    <div class="max-w-4xl mx-auto px-4 pt-24 pb-8 sm:px-6 lg:px-8">
      <div class="mb-6 flex items-center justify-between">
        <button @click="goBack" class="text-gray-300 hover:text-white inline-flex items-center gap-2">
          <Icon name="heroicons:arrow-left" class="w-5 h-5" /> Back
        </button>
        <button 
          v-if="isOwner" 
          @click="shareCurrent" 
          :disabled="showCopySuccess"
          :class="showCopySuccess ? 'bg-green-500 cursor-default' : 'bg-teal-500 hover:bg-teal-600'"
          class="px-4 py-2 text-white rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <Icon v-if="showCopySuccess" name="heroicons:check" class="w-5 h-5" />
          <Icon v-else name="heroicons:link" class="w-5 h-5" />
          {{ showCopySuccess ? 'Copied!' : 'Share' }}
        </button>
      </div>

      <div v-if="isLoading" class="text-center py-16">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400 mb-4"></div>
        <p class="text-gray-400">Loading request…</p>
      </div>

      <div v-else-if="errorMessage" class="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center text-red-200">
        {{ errorMessage }}
      </div>

      <div v-else-if="!request" class="text-center text-gray-400 py-16">Request not found.</div>

      <div v-else class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
        <div class="flex items-start justify-between mb-4">
          <h1 class="text-2xl font-semibold text-white">{{ request.projectTitle }}</h1>
          <span :class="getStatusBadgeClass(request.status)" class="px-2 py-1 rounded-full text-xs font-medium">{{ getStatusText(request.status) }}</span>
        </div>
        <p class="text-gray-300 mb-4">{{ request.showConcept }}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-300">
          <div class="flex items-center gap-2"><Icon name="heroicons:calendar" class="w-4 h-4" /> {{ formatDate(request.startDate) }}</div>
          <div class="flex items-center gap-2"><Icon name="heroicons:clock" class="w-4 h-4" /> {{ request.streamLength }}</div>
          <div class="flex items-center gap-2"><Icon name="heroicons:map-pin" class="w-4 h-4" /> {{ request.location }}</div>
          <div>Time Slots: <span class="text-gray-200">{{ (request.timeSlots || []).join(', ') }}</span></div>
          <div v-if="request.revenueShare" class="sm:col-span-2">Compensation: <span class="text-gray-200">{{ request.revenueShare }}</span></div>
        </div>

        <div v-if="request.pilotUrl" class="mt-6">
          <h3 class="text-white font-semibold mb-2">Pilot</h3>
          <video :src="request.pilotUrl" controls class="w-full rounded-lg"></video>
        </div>

        <div class="mt-6">
          <h3 class="text-white font-semibold mb-2">Tags</h3>
          <div class="flex flex-wrap gap-2">
            <span v-for="tag in (request.tags || [])" :key="tag" class="px-2 py-1 bg-white/10 text-white/80 rounded-full text-xs">{{ tag }}</span>
          </div>
        </div>

        <div class="mt-8">
          <button @click="openApply" class="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600">Apply to Collaborate</button>
        </div>
      </div>

      <!-- Apply Modal -->
      <div v-if="showApply" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" @click.self="closeApply">
        <div class="bg-gray-900 border border-white/10 rounded-2xl max-w-md w-full p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-white">Apply to Collaborate</h3>
            <button @click="closeApply" class="text-gray-400 hover:text-white" aria-label="Close"><Icon name="heroicons:x-mark" class="w-6 h-6" /></button>
          </div>
          <form @submit.prevent="submitApplication" class="space-y-4">
            <input v-model="application.fullName" type="text" required placeholder="Full name" class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400" />
            <input v-model="application.contactInfo" type="text" required placeholder="Contact (email or phone)" class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400" />
            <textarea v-model="application.interest" required rows="4" placeholder="Tell us why you're a fit" class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 resize-none"></textarea>
            <textarea v-model="application.experience" rows="3" placeholder="Relevant experience (optional)" class="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 resize-none"></textarea>
            <div class="flex items-center justify-end gap-2 pt-2">
              <button type="button" @click="closeApply" class="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
              <button type="submit" :disabled="isSubmitting" class="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:bg-gray-600">{{ isSubmitting ? 'Submitting...' : 'Submit' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from '#imports'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/TaskStore'

const route = useRoute()
const authStore = useAuthStore()
const taskStore = useTaskStore()

const id = route.params.id
const request = ref(null)
const isLoading = ref(false)
const errorMessage = ref('')
const showApply = ref(false)
const showCopySuccess = ref(false)
const isSubmitting = ref(false)
const application = ref({ fullName: '', contactInfo: '', interest: '', experience: '' })

const isOwner = computed(() => {
  const email = authStore.user?.attributes?.email
  return email && request.value?.creatorEmail && email === request.value.creatorEmail
})

const getStatusBadgeClass = (status) => {
  const classes = {
    'accepting_pilots': 'bg-green-500/20 text-green-400 border border-green-500/30',
    'casting_closed': 'bg-red-500/20 text-red-400 border border-red-500/30',
    'scheduled': 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
  }
  return classes[status] || 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
}

const getStatusText = (status) => ({ accepting_pilots: 'Accepting Pilots', casting_closed: 'Casting Closed', scheduled: 'Scheduled' })[status] || status
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'TBD')

const goBack = () => {
  if (window.history.length > 1) history.back(); else navigateTo('/profile')
}

const loadRequest = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const { success, request: req, message } = await $fetch('/api/talent-requests/get-by-id', { method: 'POST', body: { id } })
    if (!success) throw new Error(message || 'Failed to load')
    request.value = req

    // Set OG tags using channelPosterUrl when present
    const poster = req.channelPosterUrl || ''
    const currentUrl = window.location.href
    useHead({
      title: req.projectTitle,
      meta: [
        { property: 'og:title', content: req.projectTitle },
        { property: 'og:description', content: req.showConcept?.slice(0, 180) || req.projectTitle },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: currentUrl },
        ...(poster ? [{ property: 'og:image', content: poster }, { name: 'twitter:image', content: poster }] : []),
        { name: 'twitter:card', content: 'summary_large_image' }
      ]
    })
  } catch (e) {
    errorMessage.value = e.message || 'Failed to load request'
  } finally {
    isLoading.value = false
  }
}

const openApply = () => (showApply.value = true)
const closeApply = () => (showApply.value = false)

const submitApplication = async () => {
  if (!request.value?.id) return
  try {
    isSubmitting.value = true
    const body = { talentRequestId: request.value.id, ...application.value }
    const { success, message } = await $fetch('/api/talent-requests/apply', { method: 'POST', body })
    if (!success) throw new Error(message || 'Failed to submit')
    closeApply()
  } catch (err) {
    console.error(err)
  } finally {
    isSubmitting.value = false
  }
}

const shareCurrent = async () => {
  if (!request.value) return
  const baseUrl = window.location.origin
  
  // Fetch username from DynamoDB as single source of truth
  let username = ''
  try {
    const response = await $fetch('/api/creators/get-username', {
      method: 'POST',
      body: {
        userId: authStore.user?.attributes?.sub,
        email: authStore.user?.attributes?.email
      }
    })
    if (response && response.username) {
      username = response.username
    }
  } catch (error) {
    console.error('Failed to fetch username from DynamoDB:', error)
  }
  
  // If no username from DynamoDB, fall back to request data
  if (!username) {
    username = request.value.creatorUsername
    // Ensure we use username, not email
    if (username && username.includes('@')) {
      username = username.split('@')[0]
    }
  }
  
  const channel = request.value.channel
  const title = request.value.projectTitle
  const description = request.value.showConcept?.slice(0, 180) || title
  const poster = request.value.channelPosterUrl || ''

  let url = `${baseUrl}/talent-request/${encodeURIComponent(username)}/${encodeURIComponent(channel)}?rid=${encodeURIComponent(request.value.id)}&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`
  if (poster) url += `&poster=${encodeURIComponent(poster)}`

  try {
    const res = await taskStore.shortenUrl({ url })
    const shortUrl = res?.returnResult || url
    await navigator.clipboard.writeText(shortUrl)
    
    // Show copy success feedback
    showCopySuccess.value = true
    setTimeout(() => { showCopySuccess.value = false }, 2000)
  } catch {
    await navigator.clipboard.writeText(url)
    // Show copy success feedback even for fallback
    showCopySuccess.value = true
    setTimeout(() => { showCopySuccess.value = false }, 2000)
  }
}

onMounted(loadRequest)
</script>

<style scoped>
.animate-spin { animation: spin 1s linear infinite }
@keyframes spin { to { transform: rotate(360deg) } }
</style>


