<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black">
    <div class="container mx-auto px-4 py-8">
      <!-- Content -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Series Poster -->
        <div class="relative aspect-[2/3] rounded-lg overflow-hidden">
          <img
            :src="posterUrl"
            :alt="title"
            class="w-full h-full object-cover"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"></div>
        </div>

        <!-- Series Details and Verification Form -->
        <div class="text-white">
          <h1 class="text-3xl font-bold mb-4">{{ title }}</h1>
          <p class="text-gray-300 mb-6">{{ description }}</p>
          
          <!-- Phone Verification Form -->
          <div class="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-teal-900/30">
            <h2 class="text-xl font-semibold mb-4">Verify Your Phone</h2>
            
            <!-- Phone Input -->
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-200 mb-2">Phone Number</label>
              <input
                v-model="phone"
                type="tel"
                placeholder="Enter your phone number"
                class="w-full px-4 py-2 bg-white/10 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <!-- Verification Code Input -->
            <div v-if="verificationSent" class="mb-4">
              <label class="block text-sm font-medium text-gray-200 mb-2">Verification Code</label>
              <input
                v-model="verificationCode"
                type="text"
                placeholder="Enter verification code"
                class="w-full px-4 py-2 bg-white/10 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <!-- Action Buttons -->
            <div class="space-y-3">
              <button
                v-if="!verificationSent"
                @click="sendVerification"
                :disabled="isLoading"
                class="w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {{ isLoading ? 'Sending...' : 'Send Verification Code' }}
              </button>

              <button
                v-if="verificationSent"
                @click="verifyCode"
                :disabled="isLoading"
                class="w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {{ isLoading ? 'Verifying...' : 'Verify Code' }}
              </button>

              <button
                v-if="verificationSent"
                @click="resetVerification"
                class="w-full bg-gray-600/20 text-gray-300 py-2 px-4 rounded-lg hover:bg-gray-600/30 transition-colors"
              >
                Change Phone Number
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// Get the poster URL from the path
const posterPath = route.path.split('/series-posters/')[1]
const posterUrl = ref(`https://d3hv50jkrzkiyh.cloudfront.net/public/series-posters/${posterPath}`)

// Get title and description from query parameters
const title = ref(decodeURIComponent(route.query.title || ''))
const description = ref(decodeURIComponent(route.query.description || ''))

// Verification state
const phone = ref('')
const verificationCode = ref('')
const verificationSent = ref(false)
const isLoading = ref(false)

const sendVerification = async () => {
  try {
    isLoading.value = true
    const response = await $fetch('/api/twilio/verify', {
      method: 'POST',
      body: {
        phone: phone.value,
        action: 'send'
      }
    })

    if (response.success) {
      verificationSent.value = true
    } else {
      throw new Error(response.error || 'Failed to send verification code')
    }
  } catch (error) {
    alert(error.message || 'Failed to send verification code')
  } finally {
    isLoading.value = false
  }
}

const verifyCode = async () => {
  try {
    isLoading.value = true
    const response = await $fetch('/api/twilio/verify', {
      method: 'POST',
      body: {
        phone: phone.value,
        action: 'verify',
        code: verificationCode.value
      }
    })

    if (response.success && response.valid) {
      // Store the verified phone number
      localStorage.setItem('verifiedPhone', phone.value)
      // Redirect to purchase page
      router.push(`/menu/purchase/${route.params.id}`)
    } else {
      throw new Error('Invalid verification code')
    }
  } catch (error) {
    alert(error.message || 'Failed to verify code')
  } finally {
    isLoading.value = false
  }
}

const resetVerification = () => {
  verificationSent.value = false
  verificationCode.value = ''
  phone.value = ''
}
</script> 