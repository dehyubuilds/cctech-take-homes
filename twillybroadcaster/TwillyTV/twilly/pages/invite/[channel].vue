<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#084d5d] to-black px-4 py-12">
    <div class="max-w-lg w-full bg-black/40 rounded-xl p-8 border border-teal-900/30 shadow-2xl text-center">
      <img v-if="channelImageUrl" :src="channelImageUrl" alt="Channel Poster" class="w-48 h-48 object-contain rounded-lg mx-auto mb-4 border-4 border-teal-500/30 bg-black" />
      <h1 class="text-3xl font-bold text-white mb-4">You're invited to stream on the {{ channelName }} channel.</h1>
      <p class="text-gray-300 mb-6">Accept this invite to stream and collaborate on this channel. Share subscribers and split earnings automatically.</p>
      
      <!-- Show user info if authenticated -->
      <div v-if="authStore.user" class="mb-6 p-4 bg-teal-500/10 border border-teal-500/30 rounded-lg">
        <p class="text-teal-300 text-sm mb-2">Accepting as:</p>
        <p class="text-white font-semibold">{{ authStore.user.attributes?.email || authStore.user.attributes?.phone_number }}</p>
      </div>
      
      <!-- Sign in prompt if not authenticated -->
      <div v-else class="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <p class="text-yellow-300 text-sm mb-2">Please sign in to accept this invite</p>
        <button
          @click="navigateTo('/signin')"
          class="px-4 py-2 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-all duration-300"
        >
          Sign In
        </button>
      </div>
      
      <button
        @click="acceptInvite"
        :disabled="isSubmitting || !authStore.user"
        class="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
      >
        <span v-if="isSubmitting">Accepting...</span>
        <span v-else-if="!authStore.user">Sign In Required</span>
        <span v-else>Accept Invite & Get Stream Key</span>
      </button>
      <div v-if="successMessage" class="mt-6 text-green-400 text-sm">{{ successMessage }}</div>
      <div v-if="errorMessage" class="mt-6 text-red-400 text-sm">{{ errorMessage }}</div>
      <div v-if="streamKey" class="mt-6 bg-black/30 border border-teal-900/30 rounded-lg p-4">
        <p class="text-gray-300 mb-2">Your Complete RTMP URL:</p>
        <div class="flex items-center gap-2 justify-center">
          <input :value="`${RTMP_SERVER_URL}/${streamKey}`" readonly class="flex-1 bg-black/20 border border-teal-500/30 rounded-lg px-3 py-2 text-white text-sm" />
          <button @click="copyStreamKey" class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300">
            <span v-if="copied">Copied!</span>
            <span v-else>Copy</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { ref } from 'vue'
import { useHead } from '@vueuse/head'
import { useAuthStore } from '~/stores/auth'

const route = useRoute()
const authStore = useAuthStore()

// Get channelName and channelImageUrl from query params or fallback
const channelName = ref(decodeURIComponent(route.query.title || route.query.channelName || route.params.channel || 'a Twilly Channel'))
const channelImageUrl = ref(route.query.poster ? decodeURIComponent(route.query.poster) : '')
const channelId = ref(route.params.channel || '')
const title = ref(`You're invited to stream on the ${channelName.value} channel | Twilly`)
const description = ref(`Join ${channelName.value} on Twilly. Stream, create exclusive clips, and earn from your content!`)
const ogImageUrl = channelImageUrl.value || '/favicon.ico'

useHead({
  title: title.value,
  meta: [
    { name: 'description', content: description.value },
    { property: 'og:title', content: title.value },
    { property: 'og:description', content: description.value },
    { property: 'og:image', content: ogImageUrl },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: `https://twilly.com${route.fullPath}` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title.value },
    { name: 'twitter:description', content: description.value },
    { name: 'twitter:image', content: ogImageUrl }
  ]
})

// RTMP Server URL
const RTMP_SERVER_URL = 'rtmp://100.24.103.57:1935/live'

const isSubmitting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const streamKey = ref('')
const copied = ref(false)

const acceptInvite = async () => {
  if (!authStore.user) {
    errorMessage.value = 'Please sign in to accept this invite'
    return
  }

  try {
    isSubmitting.value = true
    errorMessage.value = ''
    successMessage.value = ''
    streamKey.value = ''
    copied.value = false

    // Get user info from auth store
    const userEmail = authStore.user.attributes?.email
    const userId = authStore.user.attributes?.sub || authStore.user.username

    const response = await $fetch('/api/invites/accept', {
      method: 'POST',
      body: {
        channelId: channelId.value,
        guestEmail: userEmail,
        guestUserId: userId
      }
    })
    
    if (response.success) {
      streamKey.value = response.guestStreamKey
      successMessage.value = 'Invite accepted! Use this stream key in your RTMP app.'
    } else {
      errorMessage.value = response.message || 'Failed to accept invite.'
    }
  } catch (error) {
    errorMessage.value = error.message || 'Failed to accept invite.'
  } finally {
    isSubmitting.value = false
  }
}

const copyStreamKey = async () => {
  try {
    const fullRtmpPath = `${RTMP_SERVER_URL}/${streamKey.value}`
    await navigator.clipboard.writeText(fullRtmpPath)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (e) {
    copied.value = false
  }
}
</script> 