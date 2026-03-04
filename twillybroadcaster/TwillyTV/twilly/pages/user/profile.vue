<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black py-12 px-4">
    <div class="max-w-4xl mx-auto">
      <!-- Loading State -->
      <div v-if="isLoading" class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-400 mb-4"></div>
      </div>

      <!-- Account Setup Form -->
      <div v-else-if="showPasswordSetup" class="max-w-md mx-auto bg-black/30 backdrop-blur-sm p-8 rounded-xl border border-teal-900/30">
        <h2 class="text-2xl font-semibold text-white mb-6 text-center">Set Up Your Account</h2>
        <form @submit.prevent="setupAccount" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Password</label>
            <input 
              v-model="form.password" 
              type="password"
              required
              autocomplete="new-password"
              class="w-full bg-black/20 border border-teal-500/30 rounded-lg p-3
                     text-white placeholder-gray-400 outline-none focus:border-teal-500
                     transition-all duration-300"
              placeholder="Choose a password"
            />
            <p v-if="passwordError" class="text-red-400 text-sm mt-1">{{ passwordError }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Confirm Password</label>
            <input 
              v-model="form.confirmPassword" 
              type="password"
              required
              autocomplete="new-password"
              class="w-full bg-black/20 border border-teal-500/30 rounded-lg p-3
                     text-white placeholder-gray-400 outline-none focus:border-teal-500
                     transition-all duration-300"
              placeholder="Confirm your password"
            />
            <p v-if="confirmPasswordError" class="text-red-400 text-sm mt-1">{{ confirmPasswordError }}</p>
          </div>
          <p class="text-gray-400 text-sm mt-1">
            Password must contain:
            <ul class="list-disc list-inside text-gray-400 text-sm mt-1">
              <li>At least 8 characters</li>
              <li>One uppercase letter</li>
              <li>One lowercase letter</li>
              <li>One number</li>
              <li>One special character (!@#$%^&amp;*(),.?":{}|&lt;&gt;)</li>
            </ul>
          </p>
          <button 
            type="submit" 
            class="w-full bg-teal-500 text-white py-2 px-4 rounded-lg hover:bg-teal-600
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isSettingUpAccount"
          >
            {{ isSettingUpAccount ? 'Setting up account...' : 'Create Account' }}
          </button>
        </form>
      </div>

      <!-- Regular User Content -->
      <div v-else class="text-center">
        <h1 class="text-4xl md:text-5xl font-bold text-white mb-3">
          Welcome to <span class="text-teal-400">Twilly</span>
        </h1>
        <p class="text-gray-300 text-lg mb-8">
          Your personal content hub
        </p>
        
        <!-- Add your regular user content here -->
        <div class="bg-black/30 backdrop-blur-sm p-8 rounded-xl border border-teal-900/30">
          <h2 class="text-2xl font-semibold text-white mb-6">Your Events</h2>
          <!-- Event list or other user-specific content -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { Auth } from "aws-amplify";
import { Authenticator } from "@aws-amplify/ui-vue";
import "@aws-amplify/ui-vue/styles.css";
import { useAuthStore } from "~/stores/auth";
import awsExports from '~/aws-exports';

// Configure Auth with the correct settings
Auth.configure(awsExports);

definePageMeta({
  middleware: ["account"]
});

const isLoading = ref(true);
const userIsLoggedIn = ref(null);
const authStore = useAuthStore();
const tempPhone = ref(localStorage.getItem('tempPhone'));
const tempCode = ref(localStorage.getItem('tempCode'));
const showPasswordSetup = ref(!!tempPhone.value && !!tempCode.value);
const isSettingUpAccount = ref(false);

const form = ref({
  password: '',
  confirmPassword: ''
});

const passwordError = ref('');
const confirmPasswordError = ref('');

const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&amp;*(),.?":{}|&lt;&gt;]/.test(password);

  if (password.length < minLength) {
    return 'Password must be at least 8 characters long';
  }
  if (!hasUpperCase) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!hasLowerCase) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!hasNumbers) {
    return 'Password must contain at least one number';
  }
  if (!hasSpecialChar) {
    return 'Password must contain at least one special character (!@#$%^&amp;*(),.?":{}|&lt;&gt;)';
  }
  return '';
};

const validateConfirmPassword = (password, confirmPassword) => {
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return '';
};

const setupAccount = async () => {
  try {
    isLoading.value = true;
    const phone = localStorage.getItem('tempPhone');
    const code = localStorage.getItem('tempCode');

    if (!phone || !code) {
      throw new Error('Missing verification data');
    }

    // Validate passwords before proceeding
    passwordError.value = validatePassword(form.value.password);
    confirmPasswordError.value = validateConfirmPassword(form.value.password, form.value.confirmPassword);
    
    if (passwordError.value || confirmPasswordError.value) {
      return;
    }

    // Use phone number as username (formatted as number@twilly.app)
    const username = `${phone.replace('+', '')}@twilly.app`;
    const password = form.value.password;

    try {
      // Try to sign in first
      const user = await Auth.signIn({
        username,
        password
      });
      
      await authStore.loggedIn();
      // Clear temporary data
      localStorage.removeItem('tempPhone');
      localStorage.removeItem('tempCode');
      showPasswordSetup.value = false;
      return;
    } catch (error) {
      if (error.code === 'UserNotFoundException') {
        // Create account with phone number as username
        const signUpResponse = await Auth.signUp({
          username,
          password,
          attributes: {
            email: username,
            phone_number: phone
          }
        });

        // Sign in after sign up
        const user = await Auth.signIn({
          username,
          password
        });
        
        await authStore.loggedIn();
        // Clear temporary data
        localStorage.removeItem('tempPhone');
        localStorage.removeItem('tempCode');
        showPasswordSetup.value = false;
      } else if (error.code === 'NotAuthorizedException') {
        alert('Invalid password. Please try again.');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error setting up account:', error);
    alert(error.message || 'Error setting up account');
  } finally {
    isLoading.value = false;
  }
};

onMounted(async () => {
  isLoading.value = true;
  try {
    userIsLoggedIn.value = await Auth.currentAuthenticatedUser();
  } catch (error) {
    console.error("Error verifying login:", error);
  } finally {
    isLoading.value = false;
  }
});
</script>

<style scoped>
.backdrop-blur-sm {
  backdrop-filter: blur(8px);
}

/* Amplify UI Customization */
:deep(.amplify-authenticator) {
  @apply w-full bg-transparent shadow-none border-none;
}

:deep(.amplify-tabs) {
  @apply border-b border-teal-900/30 mx-4 mt-4;
}

:deep(.amplify-tabs-item) {
  @apply text-gray-400 hover:text-teal-400 px-4 py-2;
}

:deep(.amplify-tabs-item[data-state='active']) {
  @apply text-teal-400 border-teal-400;
}

:deep(.amplify-form) {
  @apply p-4;
}

:deep(.amplify-field) {
  @apply mb-4;
}

:deep(.amplify-label) {
  @apply text-gray-300 mb-1;
}

:deep(.amplify-input) {
  @apply w-full bg-black/20 border border-teal-900/30 text-white rounded-lg px-3 py-2;
}

:deep(.amplify-input:focus) {
  @apply border-teal-400 ring-1 ring-teal-400 outline-none;
}

:deep(.amplify-button[data-variation='primary']) {
  @apply w-full bg-teal-500 hover:bg-teal-600 text-white rounded-lg px-4 py-2 border-none transition-colors duration-300;
}

:deep(.amplify-button[data-variation='link']) {
  @apply text-teal-400 hover:text-teal-300;
}

:deep(.amplify-field__show-password) {
  @apply text-teal-400 hover:text-teal-300;
}

:deep(.amplify-alert) {
  @apply bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg p-3 mb-4;
}

:deep(.amplify-field-error) {
  @apply text-red-400 text-sm mt-1;
}

:deep(.amplify-heading) {
  @apply text-white;
}

:deep(.amplify-text) {
  @apply text-gray-300;
}

:deep(.amplify-divider-text) {
  @apply text-gray-400;
}

:deep(.amplify-divider) {
  @apply border-teal-900/30;
}

:deep(.amplify-authenticator-footer) {
  @apply text-gray-400 text-sm;
}

:deep(.amplify-flex) {
  @apply w-full;
}

:deep(.amplify-field-group__field-wrapper) {
  @apply w-full;
}

:deep(.amplify-authenticator [data-amplify-container]) {
  @apply p-0;
}

:deep(.amplify-authenticator [data-amplify-form]) {
  @apply p-4;
}
</style> 