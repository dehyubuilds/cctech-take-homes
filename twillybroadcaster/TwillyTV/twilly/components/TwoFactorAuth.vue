<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
      <h2 class="text-2xl font-bold mb-6 text-gray-800">Verify Your Purchase</h2>
      
      <!-- Phone Input Step -->
      <div v-if="!codeSent">
        <p class="text-gray-600 mb-4">Please enter your phone number to receive a verification code.</p>
        <input 
          v-model="phone"
          type="tel"
          placeholder="+1234567890"
          class="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button 
          @click="sendVerificationCode"
          :disabled="isLoading"
          class="w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50"
        >
          {{ isLoading ? 'Sending...' : 'Send Code' }}
        </button>
      </div>

      <!-- Code Verification Step -->
      <div v-else>
        <p class="text-gray-600 mb-4">Enter the verification code sent to {{ phone }}</p>
        <input 
          v-model="verificationCode"
          type="text"
          placeholder="Enter code"
          class="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <div class="flex space-x-4">
          <button 
            @click="verifyCode"
            :disabled="isLoading"
            class="flex-1 bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {{ isLoading ? 'Verifying...' : 'Verify' }}
          </button>
          <button 
            @click="resendCode"
            :disabled="isLoading"
            class="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            Resend
          </button>
        </div>
      </div>

      <!-- Cancel Button -->
      <button 
        @click="$emit('close')"
        class="mt-4 text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['close', 'verified'])

const phone = ref('')
const verificationCode = ref('')
const codeSent = ref(false)
const isLoading = ref(false)

const sendVerificationCode = async () => {
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
      codeSent.value = true
    } else {
      alert('Failed to send verification code: ' + response.error)
    }
  } catch (error) {
    alert('Error sending verification code: ' + error.message)
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
        code: verificationCode.value,
        action: 'verify'
      }
    })

    if (response.success && response.valid) {
      emit('verified', { phone: phone.value })
    } else {
      alert('Invalid verification code')
    }
  } catch (error) {
    alert('Error verifying code: ' + error.message)
  } finally {
    isLoading.value = false
  }
}

const resendCode = () => {
  verificationCode.value = ''
  sendVerificationCode()
}
</script> 