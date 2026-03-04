<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-12 px-4">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-12">
        <h1 class="text-4xl md:text-6xl font-bold text-white mb-6">
          Creator <span class="text-teal-400">Portal</span>
        </h1>
        <p class="text-gray-300 text-xl max-w-3xl mx-auto">
          Everything you need to start monetizing your content and building your audience
        </p>
      </div>

      <!-- Quick Actions Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <!-- Learn About Benefits -->
        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6 hover:border-teal-400/50 transition-all duration-300">
          <div class="text-center">
            <div class="w-16 h-16 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="heroicons:star" class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-xl font-semibold text-white mb-3">Creator Benefits</h3>
            <p class="text-gray-300 mb-4">Learn about the advantages of becoming a Twilly creator and how you can earn money.</p>
            <NuxtLink
              to="/creator/benefits"
              class="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all duration-300 font-medium"
            >
              <Icon name="heroicons:arrow-right" class="w-4 h-4" />
              Learn More
            </NuxtLink>
          </div>
        </div>

        <!-- Start Creating -->
        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6 hover:border-purple-400/50 transition-all duration-300">
          <div class="text-center">
            <div class="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="heroicons:rocket-launch" class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-xl font-semibold text-white mb-3">Start Creating</h3>
            <p class="text-gray-300 mb-4">Ready to begin? Sign up as a creator and start monetizing your content today.</p>
            <NuxtLink
              to="/creator/signup"
              class="inline-flex items-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all duration-300 font-medium"
            >
              <Icon name="heroicons:arrow-right" class="w-4 h-4" />
              Get Started
            </NuxtLink>
          </div>
        </div>

        <!-- Creator Dashboard -->
        <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6 hover:border-blue-400/50 transition-all duration-300">
          <div class="text-center">
            <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="heroicons:chart-bar" class="w-8 h-8 text-white" />
            </div>
            <h3 class="text-xl font-semibold text-white mb-3">Creator Dashboard</h3>
            <p class="text-gray-300 mb-4">Track your earnings, manage content, and monitor your performance.</p>
            <NuxtLink
              to="/creator/dashboard"
              class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-300 font-medium"
            >
              <Icon name="heroicons:arrow-right" class="w-4 h-4" />
              View Dashboard
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Key Features -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <div class="space-y-6">
          <h2 class="text-3xl font-bold text-white mb-6">Why Choose Twilly?</h2>
          
          <div class="space-y-4">
            <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
              <div class="flex items-center gap-3 mb-3">
                <Icon name="heroicons:currency-dollar" class="w-8 h-8 text-teal-400" />
                <h3 class="text-xl font-semibold text-white">Instant Earnings</h3>
              </div>
              <p class="text-gray-300">Get 70% of every sale instantly. No waiting for payouts - money hits your account immediately.</p>
            </div>

            <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
              <div class="flex items-center gap-3 mb-3">
                <Icon name="heroicons:users" class="w-8 h-8 text-purple-400" />
                <h3 class="text-xl font-semibold text-white">Global Audience</h3>
              </div>
              <p class="text-gray-300">Reach viewers worldwide with our powerful content distribution and discovery tools.</p>
            </div>

            <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6">
              <div class="flex items-center gap-3 mb-3">
                <Icon name="heroicons:shield-check" class="w-8 h-8 text-blue-400" />
                <h3 class="text-xl font-semibold text-white">Secure Platform</h3>
              </div>
              <p class="text-gray-300">Built on AWS infrastructure with enterprise-grade security and 99.9% uptime.</p>
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <h2 class="text-3xl font-bold text-white mb-6">Creator Success Stories</h2>
          
          <div class="space-y-4">
            <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6">
              <div class="flex items-start gap-3">
                <div class="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon name="heroicons:user" class="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 class="text-white font-semibold mb-2">Sarah M.</h4>
                  <p class="text-gray-300 text-sm mb-2">"I started with just my phone camera. Now I'm earning $2,000+ monthly from my cooking tutorials!"</p>
                  <div class="flex items-center gap-2 text-purple-300 text-xs">
                    <Icon name="heroicons:star" class="w-4 h-4" />
                    <span>Top Creator</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-blue-500/30 p-6">
              <div class="flex items-start gap-3">
                <div class="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon name="heroicons:user" class="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 class="text-white font-semibold mb-2">Mike R.</h4>
                  <p class="text-gray-300 text-sm mb-2">"Twilly helped me turn my fitness passion into a thriving business. The platform is incredibly user-friendly."</p>
                  <div class="flex items-center gap-2 text-blue-300 text-xs">
                    <Icon name="heroicons:fire" class="w-4 h-4" />
                    <span>Rising Star</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-green-500/30 p-6">
              <div class="flex items-start gap-3">
                <div class="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Icon name="heroicons:user" class="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 class="text-white font-semibold mb-2">Alex K.</h4>
                  <p class="text-gray-300 text-sm mb-2">"From zero to $5,000 in my first 6 months. The analytics helped me understand what content works best."</p>
                  <div class="flex items-center gap-2 text-green-300 text-xs">
                    <Icon name="heroicons:trophy" class="w-4 h-4" />
                    <span>Success Story</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CTA Section -->
      <div class="text-center">
        <h2 class="text-3xl font-bold text-white mb-6">Ready to Start?</h2>
        <p class="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
          Join thousands of creators who are already earning money and building their audience on Twilly
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <NuxtLink
            to="/signin"
            class="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all duration-300 font-semibold text-lg transform hover:scale-105 active:scale-95"
          >
            <Icon name="heroicons:rocket-launch" class="w-6 h-6" />
            Start Creating Today
          </NuxtLink>
          <NuxtLink
            to="/creator/benefits"
            class="inline-flex items-center gap-2 px-8 py-4 bg-transparent text-teal-300 border border-teal-500/30 rounded-lg hover:bg-teal-500/20 transition-all duration-300 font-semibold text-lg transform hover:scale-105 active:scale-95"
          >
            <Icon name="heroicons:information-circle" class="w-6 h-6" />
            Learn More
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';

// Set page title and meta
useHead({
  title: 'Creator Portal - Twilly',
  meta: [
    {
      name: 'description',
      content: 'Join thousands of creators who are already earning money and building their audience on Twilly'
    }
  ]
});

// Ensure page starts at top
onMounted(() => {
  // Force scroll to top immediately
  window.scrollTo(0, 0);
  
  // Also ensure body scroll position is reset
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
});
</script> 