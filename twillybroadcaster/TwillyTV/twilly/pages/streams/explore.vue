<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <!-- Header -->
    <div class="sticky top-0 z-20 bg-black/80 backdrop-blur-sm border-b border-teal-500/30">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <NuxtLink to="/" class="flex items-center gap-3 text-white hover:text-teal-400 transition-colors">
            <Icon name="heroicons:arrow-left" class="w-6 h-6" />
            <span class="text-lg font-semibold">Back to Home</span>
          </NuxtLink>
          <h1 class="text-2xl font-bold text-white">Explore <span class="text-teal-400">Channels</span></h1>
          <div class="w-24"></div> <!-- Spacer for centering -->
        </div>
      </div>
    </div>

    <!-- Coming Soon Content -->
    <div class="max-w-4xl mx-auto px-4 py-16 text-center">
      <!-- Icon -->
      <div class="mb-8">
        <div class="w-24 h-24 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-teal-500/25">
          <Icon name="heroicons:play" class="w-12 h-12 text-white" />
        </div>
      </div>

      <!-- Main Message -->
      <h2 class="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
        Coming <span class="text-teal-400">Soon</span>
      </h2>
      
      <p class="text-xl md:text-2xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
        We're building something amazing for you. The channel exploration experience is being completely redesigned to match our new premium streaming platform.
      </p>

      <!-- What's Coming -->
      <div class="bg-black/30 backdrop-blur-sm rounded-2xl border border-teal-500/30 p-8 mb-8">
        <h3 class="text-2xl font-bold text-white mb-6">What's Coming</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <div class="flex items-start gap-4">
            <div class="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
              <Icon name="heroicons:tv" class="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h4 class="text-white font-semibold mb-2">Channel Discovery</h4>
              <p class="text-gray-400 text-sm">Browse and discover content across all 5 Twilly channels with advanced filtering and search.</p>
            </div>
          </div>
          
          <div class="flex items-start gap-4">
            <div class="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
              <Icon name="heroicons:heart" class="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h4 class="text-white font-semibold mb-2">Personalized Recommendations</h4>
              <p class="text-gray-400 text-sm">AI-powered content suggestions based on your viewing preferences and history.</p>
            </div>
          </div>
          
          <div class="flex items-start gap-4">
            <div class="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
              <Icon name="heroicons:clock" class="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h4 class="text-white font-semibold mb-2">Watch History</h4>
              <p class="text-gray-400 text-sm">Track your viewing progress and resume where you left off across all devices.</p>
            </div>
          </div>
          
          <div class="flex items-start gap-4">
            <div class="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
              <Icon name="heroicons:star" class="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h4 class="text-white font-semibold mb-2">Favorites & Lists</h4>
              <p class="text-gray-400 text-sm">Create custom playlists and mark your favorite episodes for easy access.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Current Access -->
      <div class="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 rounded-2xl border border-teal-500/30 p-6 mb-8">
        <h3 class="text-xl font-bold text-white mb-4">Current Access</h3>
        <p class="text-gray-300 mb-4">
          While we build the new experience, you can still access our channels directly:
        </p>
        <div class="flex flex-wrap justify-center gap-3">
          <NuxtLink 
            to="/DehSin365/twilly-after-dark"
            class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300"
          >
            Twilly After Dark
          </NuxtLink>
          <NuxtLink 
            to="/DehSin365/twilly-fit"
            class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300"
          >
            Twilly Fit
          </NuxtLink>
          <NuxtLink 
            to="/DehSin365/twilly-game-zone"
            class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300"
          >
            Twilly Game Zone
          </NuxtLink>
          <NuxtLink 
            to="/DehSin365/twilly-music-stream"
            class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300"
          >
            Twilly Music Stream
          </NuxtLink>
          <NuxtLink 
            to="/DehSin365/twilly-tech-stream"
            class="px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/30 transition-all duration-300"
          >
            Twilly Tech Stream
          </NuxtLink>
        </div>
      </div>

      <!-- CTA -->
      <div class="space-y-4">
        <NuxtLink 
          to="/subscription"
          class="inline-block px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-2xl shadow-teal-500/25"
        >
          Get Early Access
        </NuxtLink>
        <p class="text-gray-400 text-sm">
          Be the first to know when the new experience launches
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useHead } from '#app';

useHead({
  title: 'Explore Channels - Coming Soon | Twilly',
  description: 'The new channel exploration experience is coming soon. Discover content across all 5 Twilly channels with advanced features and personalized recommendations.',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' }
  ]
});
</script>

<style scoped>
/* Custom animations */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}
</style> 