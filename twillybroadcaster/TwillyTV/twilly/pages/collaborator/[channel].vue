<template>
  <div class="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155]">
    <!-- Hero Section -->
    <div class="relative overflow-hidden">
      <!-- Background Pattern -->
      <div class="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-cyan-500/5 to-blue-500/10"></div>
      
      <!-- Content -->
      <div class="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div class="text-center">
          <!-- Channel Image -->
          <div class="mb-8">
            <div v-if="channelImageUrl" class="relative inline-block">
              <img 
                :src="channelImageUrl" 
                :alt="`${channelName} Channel`" 
                class="w-32 h-32 object-cover rounded-2xl border-4 border-teal-500/30 shadow-2xl"
              />
              <div class="absolute -bottom-2 -right-2 w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
                <Icon name="heroicons:video-camera" class="w-5 h-5 text-white" />
              </div>
            </div>
            <div v-else class="w-32 h-32 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl border-4 border-teal-500/30 shadow-2xl mx-auto flex items-center justify-center">
              <Icon name="heroicons:video-camera" class="w-12 h-12 text-white" />
            </div>
          </div>

          <!-- Main Heading -->
          <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            You're invited to stream on
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
              {{ channelName }}
            </span>
          </h1>

          <!-- Description -->
          <p class="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join this exclusive channel and start streaming with your own stream key. 
            Collaborate, grow your audience, and earn together.
          </p>

          <!-- Stats -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12 max-w-2xl mx-auto">
            <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div class="text-2xl font-bold text-teal-400 mb-1">🎥</div>
              <div class="text-white font-semibold">Stream Together</div>
              <div class="text-gray-400 text-sm">Share the channel</div>
            </div>
            <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div class="text-2xl font-bold text-teal-400 mb-1">💰</div>
              <div class="text-white font-semibold">Split Earnings</div>
              <div class="text-gray-400 text-sm">Fair revenue sharing</div>
            </div>
            <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div class="text-2xl font-bold text-teal-400 mb-1">📈</div>
              <div class="text-white font-semibold">Grow Audience</div>
              <div class="text-gray-400 text-sm">Expand your reach</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Section -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      <div class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
        <!-- Authentication Status -->
        <div v-if="authStore.user" class="mb-8 p-6 bg-teal-500/10 border border-teal-500/30 rounded-xl">
          <div class="flex items-center gap-3 mb-2">
            <Icon name="heroicons:check-circle" class="w-5 h-5 text-teal-400" />
            <span class="text-teal-300 font-medium">Ready to Accept</span>
          </div>
          <p class="text-white">You'll be joining as: <span class="font-semibold">{{ authStore.user.attributes?.username || authStore.user.attributes?.email || authStore.user.attributes?.phone_number }}</span></p>
          

        </div>
        
        <div v-else class="mb-8 p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div class="flex items-center gap-3 mb-2">
            <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 text-yellow-400" />
            <span class="text-yellow-300 font-medium">Sign In Required</span>
          </div>
          <p class="text-white mb-4">Please sign in to accept this collaborator invite and get your stream key.</p>
          <button
            @click="navigateToSignin"
            class="px-6 py-3 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-all duration-300 font-semibold"
          >
            Sign In to Continue
          </button>
        </div>

        <!-- Accept Button -->
        <button
          @click="acceptInvite"
          :disabled="isSubmitting || !authStore.user"
          class="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          <div v-if="isSubmitting" class="flex items-center justify-center gap-2">
            <Icon name="heroicons:arrow-path" class="w-5 h-5 animate-spin" />
            Accepting Invite...
          </div>
          <div v-else-if="!authStore.user" class="flex items-center justify-center gap-2">
            <Icon name="heroicons:lock-closed" class="w-5 h-5" />
            Sign In Required
          </div>
          <div v-else class="flex items-center justify-center gap-2">
            <Icon name="heroicons:video-camera" class="w-5 h-5" />
            Accept Invite
          </div>
        </button>

        <!-- Messages -->
        <div v-if="successMessage" class="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <div class="flex items-center gap-2 text-green-400">
            <Icon name="heroicons:check-circle" class="w-5 h-5" />
            <span>{{ successMessage }}</span>
          </div>
        </div>
        
        <div v-if="errorMessage" class="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div class="flex items-center gap-2 text-red-400">
            <Icon name="heroicons:exclamation-triangle" class="w-5 h-5" />
            <span>{{ errorMessage }}</span>
          </div>
        </div>

        <!-- Stream Key Display -->
        <div v-if="streamKey" class="mt-8 p-6 bg-black/30 border border-teal-500/30 rounded-xl">
          <div class="flex items-center gap-2 mb-4">
            <Icon name="heroicons:key" class="w-5 h-5 text-teal-400" />
            <h3 class="text-white font-semibold">Your Stream Key</h3>
          </div>
          <p class="text-gray-300 mb-4 text-sm">
            Use this complete RTMP URL in your streaming software (OBS, Streamlabs, etc.) to stream to the {{ channelName }} channel.
          </p>
          <div class="flex items-center gap-2">
            <input 
              :value="`${RTMP_SERVER_URL}/${streamKey}`" 
              readonly 
              class="flex-1 bg-black/20 border border-teal-500/30 rounded-lg px-4 py-3 text-white text-sm font-mono"
            />
            <button 
              @click="copyStreamKey" 
              class="px-4 py-3 bg-teal-500/20 text-teal-300 border border-teal-500/30 
                     rounded-lg hover:bg-teal-500/30 transition-all duration-300"
              :class="{ 'bg-green-500/20 text-green-300 border-green-500/30': copied }"
            >
              <Icon 
                :name="copied ? 'heroicons:check' : 'heroicons:clipboard'" 
                class="w-4 h-4" 
              />
            </button>
          </div>
          
          <!-- Streaming Instructions -->
          <div class="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h4 class="text-blue-300 font-medium mb-3 flex items-center gap-2">
              <Icon name="heroicons:information-circle" class="w-5 h-5" />
              Streaming Instructions
            </h4>
            <div class="text-sm text-gray-300 space-y-2">
              <p><strong>Complete RTMP URL:</strong> [Use the URL above)</p>
              <p class="text-xs text-gray-400 mt-2">
                Copy the complete RTMP URL above and paste it directly into your streaming software (OBS, Streamlabs, etc.) to start broadcasting to the {{ channelName }} channel.
              </p>
            </div>
          </div>
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

// Get channel info from route params
const channelName = ref(decodeURIComponent(route.query.title || route.query.channelName || route.params.channel || 'a Twilly Channel'))
const channelImageUrl = ref(route.query.poster ? decodeURIComponent(route.query.poster) : '')
const channelId = ref(route.params.channel || '')

// SEO
const title = ref(`Join ${channelName.value} as a Collaborator | Twilly`)
const description = ref(`You're invited to stream on ${channelName.value}. Join this exclusive channel, get your stream key, and start collaborating!`)
const ogImageUrl = channelImageUrl.value || 'https://d4idc5cmwxlpy.cloudfront.net/Screenshot+2025-07-04+at+10.13.36%E2%80%AFPM.png'

useHead({
  title: title.value,
  meta: [
    {
      hid: 'description',
      name: 'description',
      content: description.value,
    },
    {
      hid: 'og:title',
      property: 'og:title',
      content: title.value,
    },
    {
      hid: 'og:description',
      property: 'og:description',
      content: description.value,
    },
    {
      hid: 'og:image',
      property: 'og:image',
      content: ogImageUrl,
    },
    {
      hid: 'og:image:width',
      property: 'og:image:width',
      content: '1200',
    },
    {
      hid: 'og:image:height',
      property: 'og:image:height',
      content: '630',
    },
    {
      hid: 'og:image:type',
      property: 'og:image:type',
      content: 'image/png',
    },
    {
      hid: 'og:image:alt',
      property: 'og:image:alt',
      content: title.value,
    },
    {
      hid: 'og:type',
      property: 'og:type',
      content: 'website',
    },
    {
      hid: 'og:url',
      property: 'og:url',
      content: `https://twilly.com${route.fullPath}`,
    },
    {
      hid: 'twitter:card',
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      hid: 'twitter:title',
      name: 'twitter:title',
      content: title.value,
    },
    {
      hid: 'twitter:description',
      name: 'twitter:description',
      content: description.value,
    },
    {
      hid: 'twitter:image',
      name: 'twitter:image',
      content: ogImageUrl,
    },
  ],
})

// RTMP Server URL
const RTMP_SERVER_URL = 'rtmp://100.24.103.57:1935/live'

// Reactive state
const isSubmitting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const streamKey = ref('')
const copied = ref(false)

// Navigate to signin with return URL
const navigateToSignin = () => {
  const currentUrl = window.location.href
  const signinUrl = `/signin?returnUrl=${encodeURIComponent(currentUrl)}`
  navigateTo(signinUrl)
}

// Accept invite function
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

    // Call the API to accept the invite and get a stream key
    const response = await $fetch('/api/collaborations/accept', {
      method: 'POST',
      body: {
        channelId: channelId.value,
        channelName: channelName.value,
        userId: authStore.user.attributes.sub,
        userEmail: authStore.user.attributes.email
      }
    })

    if (response.success) {
      successMessage.value = response.message || 'Successfully joined the channel as a collaborator!'
      
      // Handle conditional stream key access
      if (response.hasPayoutSetup) {
        // User has payout setup - redirect to collaborations to get stream key
        successMessage.value = 'Successfully joined as collaborator! Get your stream key from your account dashboard.'
        setTimeout(() => {
          navigateTo('/account?section=collaborations')
        }, 3000)
      } else if (response.payoutSetupRequired) {
        // User doesn't have payout setup
        successMessage.value = 'Successfully joined as collaborator! Set up your payout account to get your stream key.'
        setTimeout(() => {
          navigateTo('/account?section=payouts')
        }, 3000)
      }
    } else {
      errorMessage.value = response.message || 'Failed to accept invite'
    }
  } catch (error) {
    console.error('Error accepting invite:', error)
    errorMessage.value = error.message || 'Failed to accept invite. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

// Copy stream key function with mobile fallback
const copyStreamKey = async () => {
  try {
    const fullRtmpPath = `${RTMP_SERVER_URL}/${streamKey.value}`
    
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(fullRtmpPath)
      copied.value = true
    } else {
      // Fallback for older browsers and mobile
      const textArea = document.createElement('textarea')
      textArea.value = fullRtmpPath
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      if (successful) {
        copied.value = true
      } else {
        console.error('Copy failed on mobile')
      }
    }
    
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy stream key:', error)
  }
}
</script> 