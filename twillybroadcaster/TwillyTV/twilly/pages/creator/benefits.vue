<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-12 px-4">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="text-4xl md:text-6xl font-bold text-white mb-6">
          Creator <span class="text-teal-400">Benefits</span>
        </h1>
        <p class="text-gray-300 text-xl max-w-3xl mx-auto">
          Join thousands of creators who are already earning money and building their audience on Twilly
        </p>
      </div>

      <!-- Hero Section -->
      <div class="bg-gradient-to-r from-teal-500/20 to-teal-600/20 backdrop-blur-sm rounded-xl border border-teal-500/30 p-8 mb-12">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <h2 class="text-3xl font-bold text-white mb-4">
              Turn Your Passion Into <span class="text-teal-400">Profit</span>
            </h2>
            <p class="text-gray-300 text-lg mb-6">
              Whether you're a fitness trainer, cooking enthusiast, or tech expert, Twilly provides everything you need to monetize your expertise and reach a global audience.
            </p>
            <div class="flex flex-col sm:flex-row gap-4">
              <NuxtLink
                to="/signin"
                class="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all duration-300 font-semibold text-lg"
              >
                <Icon name="heroicons:rocket-launch" class="w-6 h-6" />
                Start Creating Today
              </NuxtLink>
              <button
                @click="scrollToBenefits"
                class="inline-flex items-center gap-2 px-8 py-4 bg-transparent text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/20 transition-all duration-300 font-semibold text-lg"
              >
                <Icon name="heroicons:arrow-down" class="w-6 h-6" />
                Learn More
              </button>
            </div>
          </div>
          <div class="text-center">
            <div class="w-64 h-64 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center mx-auto">
              <Icon name="heroicons:sparkles" class="w-32 h-32 text-white" />
            </div>
          </div>
        </div>
      </div>

      <!-- Benefits Grid -->
      <div id="benefits" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-8">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center">
              <Icon name="heroicons:currency-dollar" class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-white">Instant Earnings</h3>
          </div>
          <p class="text-gray-300 text-lg mb-4">
            Get 70% of every sale instantly. No waiting for payouts - money hits your account immediately after each transaction.
          </p>
          <ul class="space-y-2 text-gray-300">
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-teal-400" />
              <span>No minimum payout threshold</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-teal-400" />
              <span>Weekly payouts every Friday</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-teal-400" />
              <span>Secure Lemon Squeezy integration</span>
            </li>
          </ul>
        </div>

        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-8">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center">
              <Icon name="heroicons:users" class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-white">Global Audience</h3>
          </div>
          <p class="text-gray-300 text-lg mb-4">
            Reach viewers worldwide with our powerful content distribution and discovery tools.
          </p>
          <ul class="space-y-2 text-gray-300">
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-purple-400" />
              <span>Advanced content discovery</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-purple-400" />
              <span>Social sharing integration</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-purple-400" />
              <span>Community engagement tools</span>
            </li>
          </ul>
        </div>

        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-blue-500/30 p-8">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
              <Icon name="heroicons:chart-bar" class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-white">Analytics & Insights</h3>
          </div>
          <p class="text-gray-300 text-lg mb-4">
            Track your performance with detailed analytics and insights to optimize your content strategy.
          </p>
          <ul class="space-y-2 text-gray-300">
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-blue-400" />
              <span>Real-time earnings tracking</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-blue-400" />
              <span>Content performance metrics</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-blue-400" />
              <span>Audience demographics</span>
            </li>
          </ul>
        </div>

        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-green-500/30 p-8">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <Icon name="heroicons:shield-check" class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-white">Enterprise Security</h3>
          </div>
          <p class="text-gray-300 text-lg mb-4">
            Built on AWS infrastructure with enterprise-grade security and 99.9% uptime guarantee.
          </p>
          <ul class="space-y-2 text-gray-300">
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
              <span>SOC 2 Type 2 compliant</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
              <span>End-to-end encryption</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
              <span>24/7 monitoring</span>
            </li>
          </ul>
        </div>

        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-orange-500/30 p-8">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
              <Icon name="heroicons:light-bulb" class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-white">Easy to Use</h3>
          </div>
          <p class="text-gray-300 text-lg mb-4">
            Intuitive tools and workflows designed to help you focus on creating, not managing technical details.
          </p>
          <ul class="space-y-2 text-gray-300">
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-orange-400" />
              <span>Drag-and-drop uploads</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-orange-400" />
              <span>One-click publishing</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-orange-400" />
              <span>Mobile-friendly interface</span>
            </li>
          </ul>
        </div>

        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-pink-500/30 p-8">
          <div class="flex items-center gap-4 mb-6">
            <div class="w-16 h-16 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center">
              <Icon name="heroicons:heart" class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-2xl font-bold text-white">Creator Support</h3>
          </div>
          <p class="text-gray-300 text-lg mb-4">
            Dedicated support team and resources to help you succeed in your creator journey.
          </p>
          <ul class="space-y-2 text-gray-300">
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-pink-400" />
              <span>24/7 customer support</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-pink-400" />
              <span>Creator community</span>
            </li>
            <li class="flex items-center gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-pink-400" />
              <span>Educational resources</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Success Stories -->
      <div class="mb-16">
        <h2 class="text-3xl font-bold text-white text-center mb-12">Creator Success Stories</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-8">
            <div class="flex items-start gap-4 mb-6">
              <div class="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon name="heroicons:user" class="w-8 h-8 text-white" />
              </div>
              <div>
                <h4 class="text-white font-bold text-lg mb-2">Sarah M.</h4>
                <p class="text-purple-300 text-sm mb-3">Cooking & Lifestyle</p>
                <div class="flex items-center gap-2 text-purple-300 text-xs mb-3">
                  <Icon name="heroicons:star" class="w-4 h-4" />
                  <span>Top Creator</span>
                </div>
              </div>
            </div>
            <p class="text-gray-300 mb-4">
              "I started with just my phone camera. Now I'm earning $2,000+ monthly from my cooking tutorials! Twilly made it so easy to get started."
            </p>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">Joined 8 months ago</span>
              <span class="text-purple-300 font-semibold">$15,000+ earned</span>
            </div>
          </div>

          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-blue-500/30 p-8">
            <div class="flex items-start gap-4 mb-6">
              <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon name="heroicons:user" class="w-8 h-8 text-white" />
              </div>
              <div>
                <h4 class="text-white font-bold text-lg mb-2">Mike R.</h4>
                <p class="text-blue-300 text-sm mb-3">Fitness & Wellness</p>
                <div class="flex items-center gap-2 text-blue-300 text-xs mb-3">
                  <Icon name="heroicons:fire" class="w-4 h-4" />
                  <span>Rising Star</span>
                </div>
              </div>
            </div>
            <p class="text-gray-300 mb-4">
              "Twilly helped me turn my fitness passion into a thriving business. The platform is incredibly user-friendly and the analytics are game-changing."
            </p>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">Joined 6 months ago</span>
              <span class="text-blue-300 font-semibold">$8,500+ earned</span>
            </div>
          </div>

          <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-green-500/30 p-8">
            <div class="flex items-start gap-4 mb-6">
              <div class="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                <Icon name="heroicons:user" class="w-8 h-8 text-white" />
              </div>
              <div>
                <h4 class="text-white font-bold text-lg mb-2">Alex K.</h4>
                <p class="text-green-300 text-sm mb-3">Tech & Programming</p>
                <div class="flex items-center gap-2 text-green-300 text-xs mb-3">
                  <Icon name="heroicons:trophy" class="w-4 h-4" />
                  <span>Success Story</span>
                </div>
              </div>
            </div>
            <p class="text-gray-300 mb-4">
              "From zero to $5,000 in my first 6 months. The analytics helped me understand what content works best for my audience."
            </p>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-400">Joined 1 year ago</span>
              <span class="text-green-300 font-semibold">$12,000+ earned</span>
            </div>
          </div>
        </div>
      </div>

      <!-- CTA Section -->
      <div class="bg-gradient-to-r from-teal-500/20 to-teal-600/20 backdrop-blur-sm rounded-xl border border-teal-500/30 p-12 text-center">
        <h2 class="text-4xl font-bold text-white mb-6">
          Ready to Start Your <span class="text-teal-400">Creator Journey</span>?
        </h2>
        <p class="text-gray-300 text-xl mb-8 max-w-2xl mx-auto">
          Join thousands of creators who are already earning money and building their audience on Twilly. It only takes a few minutes to get started.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <NuxtLink
            to="/signin"
            class="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all duration-300 font-semibold text-lg"
          >
            <Icon name="heroicons:rocket-launch" class="w-6 h-6" />
            Become a Creator
          </NuxtLink>
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-2 px-8 py-4 bg-transparent text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/20 transition-all duration-300 font-semibold text-lg"
          >
            <Icon name="heroicons:home" class="w-6 h-6" />
            Back to Home
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const scrollToBenefits = () => {
  document.getElementById('benefits').scrollIntoView({ 
    behavior: 'smooth' 
  });
};
</script>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}
</style> 