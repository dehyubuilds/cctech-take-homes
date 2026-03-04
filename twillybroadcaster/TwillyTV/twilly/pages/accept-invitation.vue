<template>
  <div class="min-h-screen bg-gradient-to-br from-[#084d5d] to-black flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl font-bold text-white mb-4">Accepting Invitation...</h1>
      <p class="text-gray-300 mb-8">Please wait while we process your invitation.</p>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth';
import { useRoute } from 'vue-router';

const authStore = useAuthStore();
const route = useRoute();

onMounted(async () => {
  if (!authStore.authenticated) {
    navigateTo('/home');
    return;
  }

  try {
    const response = await $fetch('/api/collaborations/accept', {
      method: 'POST',
      body: {
        ownerEmail: route.query.owner,
        collaboratorEmail: authStore.user?.attributes?.email,
        folderName: route.query.folder,
        category: route.query.category
      }
    });

    if (response.success) {
      navigateTo('/invitation-accepted');
    } else {
      throw new Error(response.message || 'Failed to accept invitation');
    }
  } catch (error) {
    console.error('Error accepting invitation:', error);
    navigateTo('/dashboard');
  }
});
</script> 