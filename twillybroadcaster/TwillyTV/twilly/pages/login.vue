<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black flex items-center justify-center p-4">
    <div class="bg-white/10 backdrop-blur-lg rounded-xl p-8 w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-white mb-2">Verify Your Phone for Purchase</h1>
        <p class="text-gray-300 text-sm">Enter your phone number to verify your purchase</p>
      </div>
      
      <div class="space-y-6">
        <!-- Phone Input (shown first) -->
        <div v-if="!verificationSent">
          <label class="block text-sm font-medium text-gray-200 mb-2">Phone Number</label>
          <input
            v-model="phone"
            type="tel"
            placeholder="Enter your phone number"
            @keyup.enter="sendVerification"
            class="w-full px-4 py-2 bg-white/10 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <!-- Verification Code Input (shown after sending) -->
        <div v-if="verificationSent">
          <p class="text-gray-300 mb-2">We've sent a text message to:</p>
          <p class="text-white font-medium mb-4">Phone ending in {{ phoneEnding }}</p>
          <label class="block text-sm font-medium text-gray-200 mb-2">Enter the 6-digit code</label>
          <input
            v-model="verificationCode"
            type="text"
            maxlength="6"
            @keyup.enter="verifyCode"
            placeholder="Enter the 6-digit code"
            class="w-full px-4 py-2 bg-white/10 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="text-teal-400 text-sm text-center">
          {{ successMessage }}
        </div>

        <!-- Error Message -->
        <div v-if="errorMessage" class="text-red-400 text-sm text-center">
          {{ errorMessage }}
        </div>

        <!-- Action Buttons -->
        <div class="space-y-3">
          <!-- Send Verification Button -->
          <button
            v-if="!verificationSent"
            @click="sendVerification"
            :disabled="isLoading"
            class="w-full bg-teal-600 text-white py-3 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {{ isLoading ? 'Sending...' : 'Continue' }}
          </button>

          <!-- Verify Code Button -->
          <button
            v-if="verificationSent"
            @click="verifyCode"
            :disabled="isLoading"
            class="w-full bg-teal-600 text-white py-3 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {{ isLoading ? 'Verifying...' : 'Continue' }}
          </button>

          <div class="text-center space-y-2">
            <p v-if="verificationSent" class="text-gray-300 text-sm">
              Didn't receive a code? 
              <button @click="resendCode" class="text-teal-400 hover:text-teal-300">
                Resend
              </button>
            </p>
  
          </div>

          <div class="text-center text-xs text-gray-400 mt-4">
            <a href="#" class="hover:text-gray-300">Terms of service</a> | 
            <a href="#" class="hover:text-gray-300">Privacy policy</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useRoute } from 'vue-router'

const phone = ref('')
const verificationCode = ref('')
const verificationSent = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const route = useRoute()
const authStore = useAuthStore()

// Compute the last 4 digits of the phone number
const phoneEnding = computed(() => {
  return phone.value.slice(-4)
})

const sendVerification = async () => {
  try {
    errorMessage.value = ''
    successMessage.value = ''
    isLoading.value = true
    
    // Format phone number to E.164 format (remove any non-digit characters and add +1 for US)
    const formattedPhone = '+1' + phone.value.replace(/\D/g, '')
    
    console.log('Sending verification to:', formattedPhone)
    
    const response = await $fetch('/api/twilio/verify', {
      method: 'POST',
      body: {
        phone: formattedPhone,
        action: 'send'
      }
    })

    if (response.success) {
      verificationSent.value = true
      successMessage.value = 'Verification code sent successfully!'
    } else {
      if (response.error === 'Authenticate') {
        throw new Error('Unable to send verification code. Please try again later.')
      } else {
        throw new Error(response.error || 'Failed to send verification code')
      }
    }
  } catch (error) {
    console.error('Verification error:', error)
    errorMessage.value = error.message || 'Failed to send verification code'
  } finally {
    isLoading.value = false
  }
}

const verifyCode = async () => {
  try {
    isLoading.value = true;
    errorMessage.value = '';

    // Format phone number for Cognito
    const phoneNumber = phone.value.replace(/\D/g, '');
    const username = `+1${phoneNumber}`;

    // Verify the Twilio code
    const verifyResponse = await $fetch('/api/twilio/verify', {
      method: 'POST',
      body: {
        phone: username,
        code: verificationCode.value,
        action: 'verify'
      }
    });

    if (!verifyResponse.success) {
      throw new Error(verifyResponse.error || 'Verification failed');
    }

    // After Twilio verification, authenticate with Cognito
    const authResponse = await $fetch('/api/auth/verify', {
      method: 'POST',
      body: {
        action: 'authenticate',
        phoneNumber: username
      }
    });

    if (authResponse.success) {
      console.log('Authentication successful');
      
      // Get the return URL and purchase item from query params
      const returnUrl = route.query.returnUrl;
      const purchaseItem = route.query.purchaseItem;
      
      // Redirect back to the purchase page with verified flag
      if (returnUrl) {
        await navigateTo({
          path: returnUrl,
          query: {
            verified: 'true',
            purchaseItem
          }
        });
      } else {
        // If no return URL, go to dashboard
        await navigateTo('/dashboard');
      }
    } else {
      throw new Error(authResponse.error || 'Authentication failed');
    }
  } catch (error) {
    console.error('Verification error:', error);
    errorMessage.value = error.message || 'An error occurred during verification';
  } finally {
    isLoading.value = false;
  }
};

const resendCode = async () => {
  try {
    errorMessage.value = ''
    successMessage.value = ''
    isLoading.value = true
    
    // Format phone number to E.164 format for resend
    const formattedPhone = '+1' + phone.value.replace(/\D/g, '')
    
    const response = await $fetch('/api/twilio/verify', {
      method: 'POST',
      body: {
        phone: formattedPhone,
        action: 'send'
      }
    })

    if (response.success) {
      successMessage.value = 'New verification code sent!'
    } else {
      if (response.error === 'Authenticate') {
        throw new Error('Unable to send verification code. Please try again later.')
      } else {
        throw new Error(response.error || 'Failed to send verification code')
      }
    }
  } catch (error) {
    console.error('Resend error:', error)
    errorMessage.value = error.message || 'Failed to resend code'
  } finally {
    isLoading.value = false
  }
}

const resetVerification = () => {
  verificationSent.value = false
  verificationCode.value = ''
  errorMessage.value = ''
  successMessage.value = ''
}

const handleLogin = async () => {
  try {
    isLoading.value = true;
    errorMessage.value = '';

    // Get the return URL and purchase item from query params
    const returnUrl = route.query.returnUrl;
    const purchaseItem = route.query.purchaseItem;

    // Format phone number for Cognito
    const phoneNumber = phone.value.replace(/\D/g, '');
    const username = `+1${phoneNumber}`;

    // Send verification code via Twilio
    const twilioResponse = await $fetch('/api/twilio/verify', {
      method: 'POST',
      body: {
        phone: username,
        action: 'send'
      }
    });

    if (twilioResponse.success) {
      showVerification.value = true;
      errorMessage.value = '';
    } else {
      throw new Error(twilioResponse.error || 'Failed to send verification code');
    }
  } catch (error) {
    console.error('Login error:', error);
    errorMessage.value = error.message || 'An error occurred during login';
  } finally {
    isLoading.value = false;
  }
};

// Add watcher for auth state changes
watch(() => authStore.authenticated, (newValue) => {
  if (newValue) {
    // Get the return URL from query params
    const returnUrl = route.query.returnUrl;
    
    if (returnUrl) {
      // Redirect back to the original URL
      navigateTo(returnUrl);
    } else {
      // Default redirect to dashboard
      navigateTo('/dashboard');
    }
  }
});
</script> 