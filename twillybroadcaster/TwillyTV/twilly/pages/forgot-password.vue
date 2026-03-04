<template>
  <div class="forgot-password-page">
    <div class="page-container">
      <h1 class="page-title">Forgot Password</h1>
      
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
          <p class="section-description">Enter your email address and we'll send you a link to reset your password.</p>
          <form @submit.prevent="requestPasswordReset" class="form">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input 
                v-model="email" 
                type="email" 
                required 
                class="form-input"
                placeholder="Enter your email address"
              >
            </div>
            <button type="submit" class="submit-button">
              Send Reset Link
            </button>
          </form>
          <div class="back-to-login">
            <NuxtLink to="/login" class="back-link">
              Back to Login
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const isLoading = ref(false);
const error = ref(null);
const email = ref('');

const requestPasswordReset = async () => {
  try {
    isLoading.value = true;
    // TODO: Implement password reset request logic
    error.value = 'Password reset functionality coming soon';
  } catch (error) {
    console.error('Error requesting password reset:', error);
    error.value = 'Failed to request password reset';
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.forgot-password-page {
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
  max-width: 480px;
  margin: 0 auto;
  padding: 32px 16px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 32px;
  text-align: center;
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
  padding: 32px;
  margin-bottom: 24px;
}

.section-description {
  color: #9ca3af;
  font-size: 14px;
  margin-bottom: 24px;
  text-align: center;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #9ca3af;
}

.form-input {
  height: 48px;
  padding: 0 16px;
  background-color: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(20, 184, 166, 0.2);
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #14b8a6;
  box-shadow: 0 0 0 2px rgba(20, 184, 166, 0.2);
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
}

.submit-button:hover {
  background-color: #0d9488;
}

.back-to-login {
  margin-top: 24px;
  text-align: center;
}

.back-link {
  color: #14b8a6;
  text-decoration: none;
  font-size: 14px;
  transition: color 0.2s;
}

.back-link:hover {
  color: #0d9488;
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