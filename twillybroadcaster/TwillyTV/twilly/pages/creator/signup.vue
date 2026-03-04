<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-12 px-4">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-4xl md:text-5xl font-bold text-white mb-4">
          Become a <span class="text-teal-400">Creator</span>
        </h1>
        <p class="text-gray-300 text-lg">
          Start monetizing your content and building your audience
        </p>
      </div>

      <!-- Learn More Section (shown when info=true) -->
      <div v-if="showInfo" class="mb-12">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Creator Benefits -->
          <div class="space-y-6">
            <h2 class="text-2xl font-bold text-white mb-6">Why Become a Creator?</h2>
            
            <div class="space-y-4">
              <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
                <div class="flex items-center gap-3 mb-3">
                  <Icon name="heroicons:currency-dollar" class="w-8 h-8 text-teal-400" />
                  <h3 class="text-xl font-semibold text-white">Earn Money</h3>
                </div>
                <p class="text-gray-300">Get 70% of every sale instantly. No waiting for payouts - money hits your account immediately.</p>
              </div>

              <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
                <div class="flex items-center gap-3 mb-3">
                  <Icon name="heroicons:users" class="w-8 h-8 text-teal-400" />
                  <h3 class="text-xl font-semibold text-white">Build Your Audience</h3>
                </div>
                <p class="text-gray-300">Connect with viewers worldwide and grow your community with our powerful engagement tools.</p>
              </div>

              <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
                <div class="flex items-center gap-3 mb-3">
                  <Icon name="heroicons:chart-bar" class="w-8 h-8 text-teal-400" />
                  <h3 class="text-xl font-semibold text-white">Track Performance</h3>
                </div>
                <p class="text-gray-300">Monitor your earnings, content performance, and audience growth with detailed analytics.</p>
              </div>

              <div class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-6">
                <div class="flex items-center gap-3 mb-3">
                  <Icon name="heroicons:shield-check" class="w-8 h-8 text-teal-400" />
                  <h3 class="text-xl font-semibold text-white">Secure & Reliable</h3>
                </div>
                <p class="text-gray-300">Built on AWS infrastructure with enterprise-grade security and 99.9% uptime.</p>
              </div>
            </div>
          </div>

          <!-- Success Stories -->
          <div class="space-y-6">
            <h2 class="text-2xl font-bold text-white mb-6">Creator Success Stories</h2>
            
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

            <!-- CTA Button -->
            <div class="text-center pt-6">
              <button
                @click="startSignup"
                class="inline-flex items-center gap-2 px-8 py-4 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-all duration-300 font-semibold text-lg"
              >
                <Icon name="heroicons:rocket-launch" class="w-6 h-6" />
                Start Your Creator Journey
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Progress Steps -->
      <div v-if="!showInfo" class="mb-8">
        <div class="flex items-center justify-center space-x-4">
          <div class="flex items-center">
            <div class="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center text-sm font-semibold">
              1
            </div>
            <span class="ml-2 text-white text-sm">Basic Info</span>
          </div>
          <div class="w-16 h-0.5 bg-gray-600"></div>
          <div class="flex items-center">
            <div class="w-8 h-8 rounded-full bg-gray-600 text-gray-300 flex items-center justify-center text-sm font-semibold">
              2
            </div>
            <span class="ml-2 text-gray-400 text-sm">Payment Setup</span>
          </div>
          <div class="w-16 h-0.5 bg-gray-600"></div>
          <div class="flex items-center">
            <div class="w-8 h-8 rounded-full bg-gray-600 text-gray-300 flex items-center justify-center text-sm font-semibold">
              3
            </div>
            <span class="ml-2 text-gray-400 text-sm">Complete</span>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading && !showInfo" class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400 mb-4"></div>
        <p class="text-gray-300">{{ loadingMessage }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error && !showInfo" class="bg-red-500/10 border border-red-500/30 rounded-xl p-6 mb-6">
        <div class="flex items-center gap-3 mb-4">
          <Icon name="heroicons:exclamation-circle" class="w-6 h-6 text-red-400" />
          <h3 class="text-red-300 font-semibold">Setup Error</h3>
        </div>
        <p class="text-red-200 mb-4">{{ error }}</p>
        <button 
          @click="retrySetup"
          class="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
        >
          Try Again
        </button>
      </div>

      <!-- Success State -->
      <div v-else-if="isComplete && !showInfo" class="bg-teal-500/10 border border-teal-500/30 rounded-xl p-6 text-center">
        <div class="mb-4">
          <Icon name="heroicons:check-circle" class="w-16 h-16 text-teal-400 mx-auto" />
        </div>
        <h2 class="text-2xl font-bold text-white mb-2">Welcome to Twilly!</h2>
        <p class="text-gray-300 mb-6">Your creator account has been successfully set up.</p>
        <div class="space-y-3">
          <NuxtLink 
            to="/creator/dashboard"
            class="block w-full bg-teal-500 text-white py-3 px-6 rounded-lg hover:bg-teal-600 transition-colors"
          >
            Go to Creator Dashboard
          </NuxtLink>
          <NuxtLink 
            to="/managefiles"
            class="block w-full bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Start Uploading Content
          </NuxtLink>
        </div>
      </div>

      <!-- Signup Form -->
      <div v-else-if="!showInfo" class="bg-black/40 backdrop-blur-sm rounded-xl border border-teal-500/30 p-8">
        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Personal Information -->
          <div class="space-y-4">
            <h3 class="text-xl font-semibold text-white mb-4">Personal Information</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">First Name *</label>
                <input
                  v-model="form.firstName"
                  type="text"
                  required
                  class="w-full rounded-lg border border-teal-500/30 bg-black/20 p-3 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                  placeholder="Enter your first name"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">Last Name *</label>
                <input
                  v-model="form.lastName"
                  type="text"
                  required
                  class="w-full rounded-lg border border-teal-500/30 bg-black/20 p-3 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                  placeholder="Enter your last name"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Email Address *</label>
              <input
                v-model="form.email"
                type="email"
                required
                class="w-full rounded-lg border border-teal-500/30 bg-black/20 p-3 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Phone Number *</label>
              <input
                v-model="form.phone"
                type="tel"
                required
                class="w-full rounded-lg border border-teal-500/30 bg-black/20 p-3 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Date of Birth *</label>
              <input
                v-model="form.dateOfBirth"
                type="date"
                required
                class="w-full rounded-lg border border-teal-500/30 bg-black/20 p-3 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Social Security Number (SSN) *</label>
              <input
                v-model="form.ssn"
                type="text"
                required
                maxlength="11"
                class="w-full rounded-lg border border-teal-500/30 bg-black/20 p-3 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                placeholder="123-45-6789"
              />
              <p class="text-xs text-gray-400 mt-1">Required for tax purposes and payment processing</p>
            </div>
          </div>

          <!-- Business Information -->
          <div class="space-y-4">
            <h3 class="text-xl font-semibold text-white mb-4">Business Information (Optional)</h3>
            
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Business Name</label>
              <input
                v-model="form.businessName"
                type="text"
                class="w-full rounded-lg border border-teal-500/30 bg-black/20 p-3 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                placeholder="Your business name (if applicable)"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Business Website</label>
              <input
                v-model="form.website"
                type="url"
                class="w-full rounded-lg border border-teal-500/30 bg-black/20 p-3 text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                placeholder="https://yourwebsite.com"
              />
            </div>
          </div>

          <!-- Platform Terms -->
          <div class="space-y-4">
            <h3 class="text-xl font-semibold text-white mb-4">Platform Terms</h3>
            
            <div class="bg-gray-800/50 rounded-lg p-4 space-y-3">
              <div class="flex items-start gap-3">
                <input
                  v-model="form.acceptTerms"
                  type="checkbox"
                  required
                  class="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                />
                <label class="text-sm text-gray-300">
                  I agree to the <a href="/terms" class="text-teal-400 hover:underline">Terms of Service</a> and 
                  <a href="/privacy" class="text-teal-400 hover:underline">Privacy Policy</a>
                </label>
              </div>
              
              <div class="flex items-start gap-3">
                <input
                  v-model="form.acceptPlatformFee"
                  type="checkbox"
                  required
                  class="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                />
                <label class="text-sm text-gray-300">
                  I understand that Twilly takes a 20% platform fee on all transactions
                </label>
              </div>
              
              <div class="flex items-start gap-3">
                <input
                  v-model="form.acceptTaxResponsibility"
                  type="checkbox"
                  required
                  class="mt-1 h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                />
                <label class="text-sm text-gray-300">
                  I understand that I am responsible for reporting and paying taxes on my earnings
                </label>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading || !isFormValid"
            class="w-full bg-teal-500 text-white py-3 px-6 rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {{ isLoading ? 'Setting up your account...' : 'Create Creator Account' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';
import { useRoute } from 'vue-router';

const authStore = useAuthStore();
const route = useRoute();

// Check if we're showing the info page
const showInfo = computed(() => route.query.info === 'true');

const isLoading = ref(false);
const error = ref(null);
const isComplete = ref(false);
const loadingMessage = ref('Setting up your account...');

const form = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  ssn: '',
  businessName: '',
  website: '',
  acceptTerms: false,
  acceptPlatformFee: false,
  acceptTaxResponsibility: false
});

const isFormValid = computed(() => {
  return form.value.firstName && 
         form.value.lastName && 
         form.value.email && 
         form.value.phone && 
         form.value.dateOfBirth && 
         form.value.ssn && 
         form.value.acceptTerms && 
         form.value.acceptPlatformFee && 
         form.value.acceptTaxResponsibility;
});

const handleSubmit = async () => {
  if (!isFormValid.value) return;
  
  isLoading.value = true;
  error.value = null;
  loadingMessage.value = 'Creating your creator account...';
  
  try {
    // Step 1: Create creator profile
    const creatorResponse = await $fetch('/api/creators/create', {
      method: 'POST',
      body: {
        ...form.value,
        userId: authStore.user?.username
      }
    });
    
    if (!creatorResponse.success) {
      throw new Error(creatorResponse.error || 'Failed to create creator account');
    }
    
    loadingMessage.value = 'Setting up payment processing...';
    
    // Step 2: Lemon Squeezy integration (no account creation needed)
    console.log('Lemon Squeezy integration - payment setup handled automatically');
    
    loadingMessage.value = 'Finalizing your account...';
    
    // Step 3: Mark as complete (Lemon Squeezy handles payment setup)
    isComplete.value = true;
    
  } catch (err) {
    console.error('Creator signup error:', err);
    error.value = err.message || 'An error occurred during signup. Please try again.';
  } finally {
    isLoading.value = false;
  }
};

const retrySetup = () => {
  error.value = null;
  handleSubmit();
};

const startSignup = () => {
  // Navigate to signin page
  navigateTo('/signin');
};

// Pre-fill email if user is logged in
if (authStore.user?.attributes?.email) {
  form.value.email = authStore.user.attributes.email;
}

// Scroll to top when page loads
onMounted(() => {
  // Force scroll to top immediately
  window.scrollTo(0, 0);
  
  // Also ensure body scroll position is reset
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  
  // Additional safety check after a brief delay
  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 100);
});
</script> 