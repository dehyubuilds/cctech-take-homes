<template>
  <div class="vertical-container">
    <NavBar v-if="authStore.authenticated"/>
    <div class="main-content">
      <slot />
    </div>
    <Footer />
  </div>
</template>

<script setup>
import { useAuthStore } from "~/stores/auth";

const authStore = useAuthStore();
</script>

<style scoped>
.vertical-container {
  height: 100vh;
  overflow-y: auto;
  background: black;
}

/* Global scroll behavior for all pages */
:deep(html), :deep(body) {
  scroll-behavior: auto !important;
  scroll-padding-top: 0 !important;
  scroll-margin-top: 0 !important;
}

:deep(body > div) {
  scroll-margin-top: 0 !important;
  scroll-padding-top: 0 !important;
}
</style>
 
 