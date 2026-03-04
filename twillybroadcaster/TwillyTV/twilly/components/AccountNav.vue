<template>
  <nav class="account-nav">
    <NuxtLink to="/account/info" class="nav-item" :class="{ active: $route.path === '/account/info' }">
      Account Info
    </NuxtLink>
    <NuxtLink to="/account/password" class="nav-item" :class="{ active: $route.path === '/account/password' }">
      Password Management
    </NuxtLink>
    <NuxtLink to="/account/reset" class="nav-item" :class="{ active: $route.path === '/account/reset' }">
      Password Reset
    </NuxtLink>
    <NuxtLink 
      v-if="userType === 'creator' || userType === 'producer'"
      to="/account/stripe" 
      class="nav-item" 
      :class="{ active: $route.path === '/account/stripe' }"
    >
      Stripe Setup
    </NuxtLink>
  </nav>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const userType = computed(() => authStore.userType);
</script>

<style scoped>
.account-nav {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(20, 184, 166, 0.2);
}

.nav-item {
  color: #9ca3af;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
  transition: all 0.2s;
}

.nav-item:hover {
  color: #ffffff;
  background-color: rgba(20, 184, 166, 0.1);
}

.nav-item.active {
  color: #ffffff;
  background-color: #14b8a6;
}

.nav-item.active:hover {
  background-color: #0d9488;
}
</style> 