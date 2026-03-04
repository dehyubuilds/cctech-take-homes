<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
    <!-- Default Content -->
    <div class="flex items-center justify-center min-h-screen">
      <div class="text-center max-w-2xl mx-auto p-8">
        <!-- Icon -->
        <div class="w-24 h-24 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-8">
          <Icon name="heroicons:user-group" class="w-12 h-12 text-teal-400" />
        </div>
        
        <!-- Title -->
        <h1 class="text-3xl font-bold text-white mb-4">
          No Talent Request Found
        </h1>
        
        <!-- Description -->
        <p class="text-gray-400 text-lg mb-8 leading-relaxed">
          This channel doesn't have any active talent requests yet. 
          The creator may be working on setting up their project or the request may have been removed.
        </p>
        
        <!-- Channel Info -->
        <div v-if="channelInfo" class="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8">
          <h2 class="text-xl font-semibold text-white mb-2">Channel Information</h2>
          <p class="text-gray-300 mb-2">
            <span class="text-gray-400">Creator:</span> {{ channelInfo.creatorUsername }}
          </p>
          <p class="text-gray-300">
            <span class="text-gray-400">Channel:</span> {{ channelInfo.channelName }}
          </p>
        </div>
        
        <!-- Actions -->
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <NuxtLink 
            to="/" 
            class="inline-flex items-center px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            <Icon name="heroicons:arrow-left" class="w-5 h-5 mr-2" />
            Back to Home
          </NuxtLink>
          
          <button 
            @click="contactCreator"
            class="inline-flex items-center px-6 py-3 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors"
          >
            <Icon name="heroicons:envelope" class="w-5 h-5 mr-2" />
            Contact Creator
          </button>
        </div>
        
        <!-- Additional Info -->
        <div class="mt-8 text-sm text-gray-500">
          <p>If you're interested in collaborating, you can:</p>
          <ul class="mt-2 space-y-1 text-left max-w-md mx-auto">
            <li class="flex items-center">
              <Icon name="heroicons:check" class="w-4 h-4 text-green-400 mr-2 flex-shrink-0" />
              Check back later for new talent requests
            </li>
            <li class="flex items-center">
              <Icon name="heroicons:check" class="w-4 h-4 text-green-400 mr-2 flex-shrink-0" />
              Reach out to the creator directly
            </li>
            <li class="flex items-center">
              <Icon name="heroicons:check" class="w-4 h-4 text-green-400 mr-2 flex-shrink-0" />
              Explore other channels and creators
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// Get route parameters
const route = useRoute()
const { slug } = route.params

// Parse slug to get creator and channel info
const channelInfo = ref(null)

// Parse the slug (format: username/channel)
const parseSlug = () => {
  if (slug && slug.includes('/')) {
    const [username, channel] = slug.split('/')
    return {
      creatorUsername: username,
      channelName: channel
    }
  }
  return null
}

// Contact creator function
const contactCreator = () => {
  if (channelInfo.value) {
    // You could implement a contact form or redirect to a contact page
    alert(`Contact functionality for ${channelInfo.value.creatorUsername} would be implemented here.`)
  }
}

// Set up meta tags for SEO
useHead({
  title: 'No Talent Request Found - Twilly',
  meta: [
    {
      hid: 'description',
      name: 'description',
      content: 'This channel doesn\'t have any active talent requests yet. Check back later or contact the creator directly.',
    },
    {
      hid: 'og:title',
      property: 'og:title',
      content: 'No Talent Request Found - Twilly',
    },
    {
      hid: 'og:description',
      property: 'og:description',
      content: 'This channel doesn\'t have any active talent requests yet. Check back later or contact the creator directly.',
    },
    {
      hid: 'twitter:title',
      name: 'twitter:title',
      content: 'No Talent Request Found - Twilly',
    },
    {
      hid: 'twitter:description',
      name: 'twitter:description',
      content: 'This channel doesn\'t have any active talent requests yet. Check back later or contact the creator directly.',
    },
  ],
})

onMounted(() => {
  channelInfo.value = parseSlug()
})
</script>
