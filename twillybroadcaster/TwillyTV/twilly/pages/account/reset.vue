<template>
  <div class="password-reset-page">
    <div class="page-container">
      <AccountNav />
      <h1 class="page-title">Password Reset</h1>
      
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner"></div>
        <p class="loading-text">Loading...</p>
      </div>

      <!-- Error State -->
      <div v-if="error" class="error-container">
        {{ error }}
      </div>

      <!-- Content -->
      <div v-if="!isLoading" class="content-wrapper">
        <div class="form-container">
          <p class="section-description">If you've forgotten your password, you can request a reset link to be sent to your email.</p>
          <button @click="requestPasswordReset" class="submit-button">
            Request Password Reset
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const isLoading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    isLoading.value = true;
    
    if (!authStore.authenticated) {
      authStore.initializeAuth();
      
      if (!authStore.authenticated) {
        console.log('No authenticated user found, redirecting to login');
        navigateTo('/login');
        return;
      }
    }
  } catch (error) {
    console.error('Error initializing page:', error);
    error.value = 'Failed to load page';
  } finally {
    isLoading.value = false;
  }
});

const requestPasswordReset = async () => {
  try {
    // TODO: Implement password reset request logic
    error.value = 'Password reset functionality coming soon';
  } catch (error) {
    console.error('Error requesting password reset:', error);
    error.value = 'Failed to request password reset';
  }
};
</script>

<style scoped>
.password-reset-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #084d5d 0%, #000000 100%);
  overflow-y: auto;
}

.page-container {
  width: 100%;
  max-width: 1024px;
  margin: 0 auto;
  padding: 32px 16px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 32px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid #14b8a6;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

.loading-text {
  color: #9ca3af;
  font-size: 14px;
}

.error-container {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.form-container {
  background-color: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(20, 184, 166, 0.2);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  text-align: center;
}

.section-description {
  color: #9ca3af;
  font-size: 14px;
  margin-bottom: 24px;
}

.submit-button {
  height: 48px;
  background-color: #14b8a6;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
}

.submit-button:hover {
  background-color: #0d9488;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

::-webkit-scrollbar-thumb {
  background: rgba(20, 184, 166, 0.5);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(20, 184, 166, 0.7);
}
</style> 