<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black flex items-center justify-center p-4">
    <div class="bg-white/10 backdrop-blur-lg rounded-xl p-8 w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-white mb-2">Setting up your account...</h1>
        <p class="text-gray-300 text-sm">Please wait while we complete your setup</p>
      </div>
      
      <div class="space-y-6">
        <form @submit.prevent="setupAccount" class="space-y-6">
          <!-- Hidden form fields -->
          <input
            v-model="password"
            type="hidden"
          />
          <input
            v-model="confirmPassword"
            type="hidden"
          />
          <input
            v-model="email"
            type="hidden"
          />

          <!-- Loading Spinner -->
          <div class="flex justify-center">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-400"></div>
          </div>

          <!-- Success Message -->
          <div v-if="successMessage" class="text-teal-400 text-sm text-center">
            {{ successMessage }}
          </div>

          <!-- Error Message -->
          <div v-if="errorMessage" class="text-red-400 text-sm text-center">
            {{ errorMessage }}
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useRoute } from 'vue-router'

const route = useRoute()
const username = route.query.username
const isExistingUser = route.query.isExistingUser === 'true'

const password = ref('')
const confirmPassword = ref('')
const email = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Auto-populate form on mount
onMounted(() => {
  if (route.query.username) {
    // Generate a random password
    password.value = Math.random().toString(36).slice(-8)
    confirmPassword.value = password.value
    
    // Generate a default email if not provided
    if (!email.value) {
      email.value = `${route.query.username.replace('+', '')}@twilly.com`
    }
    
    // Auto-submit the form
    setupAccount()
  }
})

const setupAccount = async () => {
  try {
    if (!validatePassword()) return;
    
    if (!email.value) {
      errorMessage.value = 'Email is required';
      return;
    }

    const response = await $fetch('/api/auth/setup', {
      method: 'POST',
      body: {
        username: username,
        password: password.value,
        email: email.value,
        isExistingUser: isExistingUser
      }
    });

    if (response.success) {
      // Use the loggedIn method to properly set the auth state
      const authStore = useAuthStore();
      await authStore.loggedIn(response.user, response.user.userType);

      // Navigate to home
      navigateTo('/home');
    } else {
      errorMessage.value = response.error || 'Failed to setup account';
    }
  } catch (error) {
    console.error('Setup error:', error);
    errorMessage.value = error.message || 'Failed to setup account';
  }
};

const validatePassword = () => {
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match'
    return false
  }

  if (password.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters long'
    return false
  }

  return true
}
</script> 